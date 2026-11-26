import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  UPLOADS_DIR,
  addAssemblyMinutes,
  addIncident,
  addIncidentMessage,
  addIncidentQuote,
  addNotice,
  addPreventiveTask,
  addTransaction,
  updateTransaction,
  addVendor,
  addVote,
  authenticateUser,
  castVote,
  changeUserPassword,
  completePreventiveTaskAtomic,
  createBuilding,
  createUser,
  deletePaymentAtomic,
  deleteTransaction,
  deleteUser,
  getAuditLogs,
  getBuildingState,
  getDefaultBuildingId,
  getIncidentById,
  getOrCreateSessionSecret,
  getUserById,
  hasAnyBuilding,
  initializeBuildingIfEmpty,
  listBuildings,
  listUsers,
  recordPaymentAtomic,
  replaceBuildingState,
  selectIncidentQuote,
  toggleVoteStatus,
  updateApartment,
  updateBudgetPlan,
  updateBuildingInfo,
  updateHouseRules,
  updateIncidentStatusAtomic,
  updatePaymentAtomic,
} from './db.mjs';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const portArg = process.argv.find((a) => a.startsWith('--port='));
const PORT = Number((portArg ? portArg.split('=')[1] : null) || process.env.PORT || 3000);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_SECRET = getOrCreateSessionSecret();

const RESIDENT_REPORT_WINDOW_MS = 10 * 60 * 1000;
const RESIDENT_REPORT_MAX = 5;
const residentReportBuckets = new Map();
const ALLOWED_INCIDENT_CATEGORIES = new Set([
  'ascenseur',
  'surpresseur_eau',
  'electricite_eclairage',
  'porte_interphone',
  'plomberie_evacuation',
  'nettoyage_ordures',
  'securite_gardiennage',
  'autre',
]);
const ALLOWED_INCIDENT_PRIORITIES = new Set(['normale', 'elevee', 'urgente']);

function checkResidentReportRateLimit(req) {
  const ip =
    String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim() ||
    req.socket?.remoteAddress ||
    'local';
  const now = Date.now();
  const recent = (residentReportBuckets.get(ip) || []).filter((ts) => now - ts < RESIDENT_REPORT_WINDOW_MS);
  if (recent.length >= RESIDENT_REPORT_MAX) {
    residentReportBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  residentReportBuckets.set(ip, recent);
  return true;
}

function signToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      cookies[k] = v;
    }
  }
  return cookies;
}

const RESIDENT_ACTOR = {
  id: 'resident',
  username: 'resident',
  fullName: 'Résident',
  role: 'resident',
  isDefaultPassword: false,
};

function getRequestActor(req) {
  let token = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies.gest_aadl_session || null;
  }
  if (!token) return RESIDENT_ACTOR;
  const payload = verifyToken(token);
  if (!payload?.userId) return RESIDENT_ACTOR;
  const user = getUserById(payload.userId);
  return user || RESIDENT_ACTOR;
}

function canFinance(role) {
  return role === 'president' || role === 'treasurer';
}

function canMaintenance(role) {
  return role === 'president' || role === 'technical';
}

function canGovernance(role) {
  return role === 'president' || role === 'treasurer' || role === 'technical';
}

function maskPhone(phone) {
  if (!phone || phone === '-') return '-';
  const clean = String(phone).trim();
  if (clean.length <= 4) return '••••';
  return `${clean.slice(0, 4)} •• •• ${clean.slice(-2)}`;
}

function sanitizeDataForResident(data) {
  if (!data) return null;
  return {
    ...data,
    building: {
      ...data.building,
      doorCode: '•••••',
    },
    apartments: (data.apartments || []).map((apt) => ({
      ...apt,
      resident: {
        ...apt.resident,
        birthDate: undefined,
        email: undefined,
        phone: maskPhone(apt.resident?.phone),
        aadlFolderNumber: apt.resident?.aadlFolderNumber ? '••-••••••' : undefined,
        emergencyContactName: undefined,
        emergencyContactPhone: undefined,
        keysNotes: undefined,
      },
      tenant: apt.tenant
        ? {
            name: apt.tenant.name,
            phone: maskPhone(apt.tenant.phone),
            startDate: apt.tenant.startDate,
          }
        : undefined,
    })),
  };
}

function sendJson(res, statusCode, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function readJsonBody(req, maxBytes = 6 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveUpload(req, res, urlPath) {
  const safeName = path.basename(urlPath);
  const filePath = path.join(UPLOADS_DIR, safeName);
  if (!filePath.startsWith(UPLOADS_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('File not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000',
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveStatic(req, res, urlPath) {
  if (!fs.existsSync(DIST_DIR)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Frontend build (dist/) not found. Run "npm run build" or use "npm run dev".');
    return;
  }
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const urlPath = reqUrl.pathname;
  const method = req.method || 'GET';

  if (urlPath.startsWith('/uploads/') && method === 'GET') {
    return serveUpload(req, res, urlPath);
  }

  if (urlPath.startsWith('/api/')) {
    const actor = getRequestActor(req);
    const buildingId = reqUrl.searchParams.get('buildingId') || getDefaultBuildingId();

    try {
      // Health
      if (urlPath === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          mode: 'sqlite',
          hasData: hasAnyBuilding(),
        });
      }

      // Auth
      if (urlPath === '/api/auth/status' && method === 'GET') {
        return sendJson(res, 200, {
          role: actor.role,
          user: {
            id: actor.id,
            username: actor.username,
            fullName: actor.fullName,
            role: actor.role,
          },
          isDefaultPassword: Boolean(actor.isDefaultPassword),
        });
      }

      if (urlPath === '/api/auth/login' && method === 'POST') {
        const body = await readJsonBody(req);
        const user = authenticateUser(body.username || 'president', body.password);
        if (!user) {
          return sendJson(res, 401, { error: 'Identifiant ou mot de passe incorrect.' });
        }
        const token = signToken({ userId: user.id, role: user.role, exp: Date.now() + SESSION_TTL_MS });
        return sendJson(
          res,
          200,
          {
            role: user.role,
            user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
            isDefaultPassword: user.isDefaultPassword,
            token,
          },
          {
            'Set-Cookie': `gest_aadl_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
          }
        );
      }

      if (urlPath === '/api/auth/logout' && method === 'POST') {
        return sendJson(
          res,
          200,
          { role: 'resident' },
          { 'Set-Cookie': 'gest_aadl_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' }
        );
      }

      if (urlPath === '/api/auth/password' && method === 'POST') {
        if (actor.role === 'resident') {
          return sendJson(res, 403, { error: 'Accès réservé aux membres du Bureau.' });
        }
        const body = await readJsonBody(req);
        try {
          changeUserPassword(actor.id, body.currentPassword, body.newPassword);
          return sendJson(res, 200, { ok: true });
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Users RBAC management (President only)
      if (urlPath === '/api/users' && method === 'GET') {
        if (actor.role !== 'president') return sendJson(res, 403, { error: 'Réservé au Président du Syndic.' });
        return sendJson(res, 200, { users: listUsers() });
      }

      if (urlPath === '/api/users' && method === 'POST') {
        if (actor.role !== 'president') return sendJson(res, 403, { error: 'Réservé au Président du Syndic.' });
        const body = await readJsonBody(req);
        try {
          const created = createUser(body, actor, buildingId);
          return sendJson(res, 201, { user: created });
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (urlPath.startsWith('/api/users/') && method === 'DELETE') {
        if (actor.role !== 'president') return sendJson(res, 403, { error: 'Réservé au Président du Syndic.' });
        const targetId = decodeURIComponent(urlPath.slice('/api/users/'.length));
        try {
          const ok = deleteUser(targetId, actor, buildingId);
          return sendJson(res, ok ? 200 : 404, { ok });
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Buildings & State
      if (urlPath === '/api/buildings' && method === 'GET') {
        return sendJson(res, 200, { buildings: listBuildings() });
      }

      if (urlPath === '/api/buildings' && method === 'POST') {
        if (actor.role !== 'president') return sendJson(res, 403, { error: 'Réservé au Président du Syndic.' });
        const body = await readJsonBody(req);
        if (!body?.data?.building) return sendJson(res, 400, { error: 'Données bâtiment invalides.' });
        const id = createBuilding(body.data, actor);
        return sendJson(res, 201, { ok: true, id, buildings: listBuildings() });
      }

      if (urlPath === '/api/state' && method === 'GET') {
        const state = getBuildingState(buildingId);
        const payload = actor.role === 'resident' ? sanitizeDataForResident(state) : state;
        return sendJson(res, 200, {
          role: actor.role,
          buildingId,
          buildings: listBuildings(),
          data: payload,
        });
      }

      if (urlPath === '/api/state/init' && method === 'POST') {
        if (hasAnyBuilding()) {
          return sendJson(res, 200, { ok: true, alreadyInitialized: true });
        }
        const body = await readJsonBody(req);
        if (!body?.data?.building || !Array.isArray(body?.data?.apartments)) {
          return sendJson(res, 400, { error: 'Structure initiale invalide.' });
        }
        const targetId = body.data.building.id || 'bldg-e36';
        initializeBuildingIfEmpty(targetId, body.data, actor);
        return sendJson(res, 201, { ok: true, buildingId: targetId });
      }

      if (urlPath === '/api/state' && method === 'PUT') {
        if (actor.role !== 'president') {
          return sendJson(res, 403, { error: 'Restauration/import réservé au Président du Syndic.' });
        }
        const body = await readJsonBody(req);
        if (!body?.data?.building || !Array.isArray(body?.data?.apartments)) {
          return sendJson(res, 400, { error: 'Données invalides.' });
        }
        const targetId = body.buildingId || buildingId || body.data.building.id || 'bldg-e36';
        replaceBuildingState(targetId, body.data, actor);
        return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() });
      }

      // Building Info
      if (urlPath === '/api/building' && method === 'PUT') {
        if (actor.role !== 'president') return sendJson(res, 403, { error: 'Réservé au Président.' });
        const body = await readJsonBody(req);
        const updated = updateBuildingInfo(buildingId, body.building, actor);
        return sendJson(res, 200, { ok: true, building: updated });
      }

      // Apartments
      if (urlPath.startsWith('/api/apartments/') && method === 'PUT') {
        if (!canFinance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const body = await readJsonBody(req);
        const updated = updateApartment(buildingId, body.apartment, actor);
        return sendJson(res, 200, { ok: true, apartment: updated });
      }

      // Payments (Atomic: Payment + Treasury Transaction + Audit Log)
      if (urlPath === '/api/payments' && method === 'POST') {
        if (!canFinance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Trésorier.' });
        const body = await readJsonBody(req);
        if (!body?.payment?.id) return sendJson(res, 400, { error: 'Paiement invalide.' });
        const resObj = recordPaymentAtomic(buildingId, body.payment, actor);
        return sendJson(res, 201, { ok: true, ...resObj });
      }

      if (urlPath.startsWith('/api/payments/') && method === 'PUT') {
        if (!canFinance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Trésorier.' });
        const paymentId = decodeURIComponent(urlPath.slice('/api/payments/'.length));
        const body = await readJsonBody(req);
        const payment = body?.payment;
        if (!paymentId || !payment || !Number.isFinite(Number(payment.amountDZD)) || Number(payment.amountDZD) <= 0) {
          return sendJson(res, 400, { error: 'Cotisation ou montant invalide.' });
        }
        const resObj = updatePaymentAtomic(buildingId, paymentId, payment, actor);
        return sendJson(res, resObj ? 200 : 404, { ok: Boolean(resObj), ...(resObj || { error: 'Cotisation introuvable.' }) });
      }

      if (urlPath.startsWith('/api/payments/') && method === 'DELETE') {
        if (!canFinance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Trésorier.' });
        const paymentId = decodeURIComponent(urlPath.slice('/api/payments/'.length));
        const ok = deletePaymentAtomic(buildingId, paymentId, actor);
        return sendJson(res, ok ? 200 : 404, { ok, ...(ok ? {} : { error: 'Cotisation introuvable.' }) });
      }

      // Transactions & Budget
      if (urlPath === '/api/transactions' && method === 'POST') {
        if (!canFinance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Trésorier.' });
        const body = await readJsonBody(req);
        if (!body?.transaction?.id) return sendJson(res, 400, { error: 'Transaction invalide.' });
        const tx = addTransaction(buildingId, body.transaction, actor);
        return sendJson(res, 201, { ok: true, transaction: tx });
      }

      if (urlPath.startsWith('/api/transactions/') && method === 'PUT') {
        if (!canFinance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Trésorier.' });
        const txId = decodeURIComponent(urlPath.slice('/api/transactions/'.length));
        const body = await readJsonBody(req);
        const tx = body?.transaction;
        if (!txId || !tx || !Number.isFinite(Number(tx.amountDZD)) || Number(tx.amountDZD) <= 0) {
          return sendJson(res, 400, { error: 'Opération ou montant invalide.' });
        }
        const updated = updateTransaction(buildingId, txId, tx, actor);
        return sendJson(res, updated ? 200 : 404, {
          ok: Boolean(updated),
          ...(updated ? { transaction: updated } : { error: 'Opération introuvable.' }),
        });
      }

      if (urlPath.startsWith('/api/transactions/') && method === 'DELETE') {
        if (!canFinance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Trésorier.' });
        const txId = decodeURIComponent(urlPath.slice('/api/transactions/'.length));
        const ok = deleteTransaction(buildingId, txId, actor);
        return sendJson(res, ok ? 200 : 404, { ok, ...(ok ? {} : { error: 'Opération introuvable.' }) });
      }

      if (urlPath === '/api/budget' && method === 'PUT') {
        if (!canFinance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Trésorier.' });
        const body = await readJsonBody(req);
        const plan = updateBudgetPlan(buildingId, body.budgetPlan || [], actor);
        return sendJson(res, 200, { ok: true, budgetPlan: plan });
      }

      // File Uploads (stored separately in server/uploads/)
      if (urlPath === '/api/uploads' && method === 'POST') {
        if (!canGovernance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const body = await readJsonBody(req, 5 * 1024 * 1024);
        const rawDataUrl = String(body.dataUrl || '');
        const match = rawDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
          return sendJson(res, 400, { error: 'Format de fichier non autorisé (PNG, JPG, WEBP ou PDF uniquement).' });
        }
        const mime = match[1];
        const buf = Buffer.from(match[2], 'base64');
        if (buf.length > 3 * 1024 * 1024) {
          return sendJson(res, 400, { error: 'Fichier trop volumineux (max 3 Mo).' });
        }
        const extMap = {
          'image/png': '.png',
          'image/jpeg': '.jpg',
          'image/jpg': '.jpg',
          'image/webp': '.webp',
          'application/pdf': '.pdf',
        };
        const ext = extMap[mime] || '.bin';
        const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buf);
        return sendJson(res, 201, {
          ok: true,
          url: `/uploads/${storedName}`,
          name: path.basename(String(body.filename || storedName)),
        });
      }

      // Resident Public Incident Report (Validated, Sanitized, Rate-Limited)
      if (urlPath === '/api/incidents/report' && method === 'POST') {
        if (!checkResidentReportRateLimit(req)) {
          return sendJson(res, 429, {
            error: 'Trop de signalements récents. Veuillez patienter quelques minutes avant de réessayer.',
          });
        }
        const body = await readJsonBody(req);
        const raw = body?.report || body || {};
        const title = String(raw.title || '').trim().slice(0, 140);
        const location = String(raw.location || '').trim().slice(0, 120);
        const description = String(raw.description || '').trim().slice(0, 1000);
        const reportedBy = String(raw.reportedBy || '').trim().slice(0, 80);
        const category = ALLOWED_INCIDENT_CATEGORIES.has(raw.category) ? raw.category : 'autre';
        const priority = ALLOWED_INCIDENT_PRIORITIES.has(raw.priority) ? raw.priority : 'normale';
        const floorNum = Number.isFinite(Number(raw.floor)) ? Math.max(0, Math.min(30, Math.trunc(Number(raw.floor)))) : 0;

        if (title.length < 3) {
          return sendJson(res, 400, { error: 'Veuillez indiquer un intitulé clair (au moins 3 caractères).' });
        }
        if (location.length < 2) {
          return sendJson(res, 400, { error: 'Veuillez préciser le lieu ou la zone concernée.' });
        }

        const nowIso = new Date().toISOString();
        const effectiveReporter = reportedBy.length >= 2 ? reportedBy : 'Résident du bâtiment';
        const apartmentNumber = String(raw.apartmentNumber || '').trim().slice(0, 30);
        const initialMessage = String(raw.initialMessage || '').trim().slice(0, 800);
        const openingText = initialMessage || description || `Signalement : ${title} (${location})`;

        const cleanIncident = {
          id: `inc-res-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          title,
          category,
          location,
          floor: floorNum,
          priority,
          status: 'signale',
          description,
          reportedBy: effectiveReporter,
          reportedDate: nowIso,
          estimatedCostDZD: 0,
          quotes: [],
          messages: [
            {
              id: `msg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
              senderRole: 'resident',
              senderName: effectiveReporter,
              ...(apartmentNumber ? { apartmentNumber } : {}),
              text: openingText,
              timestamp: nowIso,
            },
          ],
        };

        const residentActor = {
          id: actor.role === 'resident' ? 'resident-portal' : actor.id,
          username: actor.role === 'resident' ? 'resident' : actor.username,
          fullName: cleanIncident.reportedBy,
          role: 'resident',
        };
        const inc = addIncident(buildingId, cleanIncident, residentActor);
        return sendJson(res, 201, { ok: true, incident: inc });
      }

      // Incidents & Quotes
      if (urlPath === '/api/incidents' && method === 'POST') {
        if (!canMaintenance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Resp. Technique.' });
        const body = await readJsonBody(req);
        const inc = addIncident(buildingId, body.incident, actor);
        return sendJson(res, 201, { ok: true, incident: inc });
      }

      const incQuoteSelectMatch = urlPath.match(/^\/api\/incidents\/([^/]+)\/quotes\/([^/]+)\/select$/);
      if (incQuoteSelectMatch && method === 'PATCH') {
        if (!canMaintenance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const incId = decodeURIComponent(incQuoteSelectMatch[1]);
        const quoteId = decodeURIComponent(incQuoteSelectMatch[2]);
        const inc = selectIncidentQuote(buildingId, incId, quoteId, actor);
        return sendJson(res, inc ? 200 : 404, { ok: Boolean(inc), incident: inc });
      }

      const incQuoteMatch = urlPath.match(/^\/api\/incidents\/([^/]+)\/quotes$/);
      if (incQuoteMatch && method === 'POST') {
        if (!canMaintenance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const incId = decodeURIComponent(incQuoteMatch[1]);
        const body = await readJsonBody(req);
        const inc = addIncidentQuote(buildingId, incId, body.quote, actor);
        return sendJson(res, inc ? 200 : 404, { ok: Boolean(inc), incident: inc });
      }

      const incMessagesMatch = urlPath.match(/^\/api\/incidents\/([^/]+)\/messages$/);
      if (incMessagesMatch && method === 'GET') {
        const incId = decodeURIComponent(incMessagesMatch[1]);
        const target = getIncidentById(buildingId, incId);
        if (!target) return sendJson(res, 404, { ok: false, error: 'Incident introuvable.' });
        return sendJson(res, 200, {
          ok: true,
          messages: target.messages || [],
          status: target.status,
          assignedVendor: target.assignedVendor,
          resolutionNotes: target.resolutionNotes,
        });
      }

      if (incMessagesMatch && method === 'POST') {
        const incId = decodeURIComponent(incMessagesMatch[1]);
        const body = await readJsonBody(req);
        const text = String(body?.text || '').trim().slice(0, 800);
        if (!text) return sendJson(res, 400, { error: 'Veuillez saisir un message.' });

        const aptNum = String(body?.apartmentNumber || '').trim().slice(0, 30);
        const rawSender = String(body?.senderName || '').trim().slice(0, 80);
        const isBureauSender =
          actor.role === 'president' || actor.role === 'treasurer' || actor.role === 'technical';
        const senderRole = isBureauSender ? actor.role : 'resident';
        const senderName = isBureauSender
          ? actor.fullName
          : rawSender.length >= 2
          ? rawSender
          : aptNum
          ? `Résident (${aptNum})`
          : 'Résident';

        const newMessage = {
          id: `msg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          senderRole,
          senderName,
          ...(!isBureauSender && aptNum ? { apartmentNumber: aptNum } : {}),
          text,
          timestamp: new Date().toISOString(),
        };

        const msgActor = isBureauSender ? actor : { id: 'resident-portal', username: 'resident', fullName: senderName, role: 'resident' };
        const resObj = addIncidentMessage(buildingId, incId, newMessage, msgActor);
        if (!resObj) return sendJson(res, 404, { error: 'Incident introuvable.' });
        return sendJson(res, 201, { ok: true, ...resObj });
      }

      const incPatchMatch = urlPath.match(/^\/api\/incidents\/([^/]+)$/);
      if (incPatchMatch && method === 'PATCH') {
        if (!canMaintenance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const incId = decodeURIComponent(incPatchMatch[1]);
        const body = await readJsonBody(req);
        const resObj = updateIncidentStatusAtomic(buildingId, incId, body.status, body.actualCost, body.resolutionNotes, actor);
        return sendJson(res, resObj ? 200 : 404, { ok: Boolean(resObj), ...(resObj || {}) });
      }

      // Preventive Maintenance
      if (urlPath === '/api/preventive' && method === 'POST') {
        if (!canMaintenance(actor.role)) return sendJson(res, 403, { error: 'Réservé au Président ou Resp. Technique.' });
        const body = await readJsonBody(req);
        const task = addPreventiveTask(buildingId, body.task, actor);
        return sendJson(res, 201, { ok: true, task });
      }

      const prevCompleteMatch = urlPath.match(/^\/api\/preventive\/([^/]+)\/complete$/);
      if (prevCompleteMatch && method === 'POST') {
        if (!canMaintenance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const taskId = decodeURIComponent(prevCompleteMatch[1]);
        const body = await readJsonBody(req);
        const resObj = completePreventiveTaskAtomic(
          buildingId,
          taskId,
          body.performedDate,
          body.performedBy,
          body.costDZD,
          body.notes,
          actor
        );
        return sendJson(res, resObj ? 200 : 404, { ok: Boolean(resObj), ...(resObj || {}) });
      }

      // Governance: Notices, Votes, Minutes, House Rules
      if (urlPath === '/api/notices' && method === 'POST') {
        if (!canGovernance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const body = await readJsonBody(req);
        const notice = addNotice(buildingId, body.notice, actor);
        return sendJson(res, 201, { ok: true, notice });
      }

      if (urlPath === '/api/votes' && method === 'POST') {
        if (!canGovernance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const body = await readJsonBody(req);
        const vote = addVote(buildingId, body.vote, actor);
        return sendJson(res, 201, { ok: true, vote });
      }

      const voteToggleMatch = urlPath.match(/^\/api\/votes\/([^/]+)\/toggle$/);
      if (voteToggleMatch && method === 'PATCH') {
        if (!canGovernance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const voteId = decodeURIComponent(voteToggleMatch[1]);
        const vote = toggleVoteStatus(buildingId, voteId, actor);
        return sendJson(res, vote ? 200 : 404, { ok: Boolean(vote), vote });
      }

      const voteCastMatch = urlPath.match(/^\/api\/votes\/([^/]+)\/cast$/);
      if (voteCastMatch && method === 'POST') {
        if (!canGovernance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const voteId = decodeURIComponent(voteCastMatch[1]);
        const body = await readJsonBody(req);
        const result = castVote(buildingId, voteId, body.optionId, body.apartmentId, actor);
        if (result.error) return sendJson(res, 400, { error: result.error });
        return sendJson(res, 200, { ok: true, vote: result.vote });
      }

      if (urlPath === '/api/minutes' && method === 'POST') {
        if (!canGovernance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const body = await readJsonBody(req);
        const minutes = addAssemblyMinutes(buildingId, body.minutes, actor);
        return sendJson(res, 201, { ok: true, minutes });
      }

      if (urlPath === '/api/rules' && method === 'PUT') {
        if (!canGovernance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const body = await readJsonBody(req);
        const rules = updateHouseRules(buildingId, body.houseRules || [], actor);
        return sendJson(res, 200, { ok: true, houseRules: rules });
      }

      // Vendors
      if (urlPath === '/api/vendors' && method === 'POST') {
        if (!canGovernance(actor.role)) return sendJson(res, 403, { error: 'Accès refusé.' });
        const body = await readJsonBody(req);
        const vendor = addVendor(buildingId, body.vendor, actor);
        return sendJson(res, 201, { ok: true, vendor });
      }

      // Audit Logs (Bureau only)
      if (urlPath === '/api/audit-logs' && method === 'GET') {
        if (actor.role === 'resident') return sendJson(res, 403, { error: 'Accès réservé au Bureau Syndic.' });
        const limit = Number(reqUrl.searchParams.get('limit') || 150);
        return sendJson(res, 200, { logs: getAuditLogs(buildingId, limit) });
      }

      return sendJson(res, 404, { error: 'Route API introuvable.' });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Erreur serveur.' });
    }
  }

  return serveStatic(req, res, urlPath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Gest-AADL SQLite Server] Listening on http://localhost:${PORT}`);
});
