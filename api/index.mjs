import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { INITIAL_BUILDING_DATA } from './seedData.mjs';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESIDENT_REPORT_WINDOW_MS = 10 * 60 * 1000;
const RESIDENT_REPORT_MAX = 5;
const residentReportBuckets = new Map();
const RESIDENT_CHAT_WINDOW_MS = 5 * 60 * 1000;
const RESIDENT_CHAT_MAX = 20;
const residentChatBuckets = new Map();

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

const RESIDENT_ACTOR = {
  id: 'resident',
  username: 'resident',
  fullName: 'Résident',
  role: 'resident',
  isDefaultPassword: false,
};

let initPromise = null;
let cachedSessionSecret = null;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  ).trim();
}

function getSql() {
  const conn = getConnectionString();
  if (!conn) return null;
  return neon(conn);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function signToken(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
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

function parsePayload(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function ensureInitialized(sql) {
  if (initPromise && cachedSessionSecret) {
    return cachedSessionSecret;
  }

  initPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS gest_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS gest_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_default_password BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS gest_buildings (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS gest_audit_logs (
        id TEXT PRIMARY KEY,
        building_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        summary TEXT NOT NULL,
        amount_dzd DOUBLE PRECISION
      )
    `;

    // Shared session secret across serverless instances
    const genSecret = crypto.randomBytes(32).toString('hex');
    await sql`
      INSERT INTO gest_meta (key, value)
      VALUES ('session_secret', ${genSecret})
      ON CONFLICT (key) DO NOTHING
    `;
    const secretRows = await sql`SELECT value FROM gest_meta WHERE key = 'session_secret' LIMIT 1`;
    cachedSessionSecret = secretRows[0]?.value || genSecret;

    // One-time default Bureau users seed
    const userSeedLock = await sql`
      INSERT INTO gest_meta (key, value)
      VALUES ('users_seeded', '1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `;
    if (userSeedLock.length > 0) {
      const cntRows = await sql`SELECT COUNT(*)::int AS cnt FROM gest_users`;
      if ((cntRows[0]?.cnt || 0) === 0) {
        const now = new Date().toISOString();
        const defaults = [
          {
            id: 'usr-president',
            username: 'president',
            fullName: 'M. MELLIKECHE FERHAT',
            role: 'president',
            password: process.env.SYNDIC_DEFAULT_PASSWORD || 'syndic2026',
          },
          {
            id: 'usr-tresorier',
            username: 'tresorier',
            fullName: 'M. HAMOUDI NOURDINE',
            role: 'treasurer',
            password: process.env.SYNDIC_TREASURER_PASSWORD || 'tresorier2026',
          },
          {
            id: 'usr-technique',
            username: 'technique',
            fullName: 'M. BELKACEMI OMAR',
            role: 'technical',
            password: process.env.SYNDIC_TECH_PASSWORD || 'tech2026',
          },
        ];
        for (const u of defaults) {
          const salt = crypto.randomBytes(16).toString('hex');
          const pwdHash = hashPassword(u.password, salt);
          await sql`
            INSERT INTO gest_users (id, username, full_name, role, salt, password_hash, is_default_password, created_at)
            VALUES (${u.id}, ${u.username}, ${u.fullName}, ${u.role}, ${salt}, ${pwdHash}, TRUE, ${now})
            ON CONFLICT (id) DO NOTHING
          `;
        }
      }
    }

    // One-time initial building seed (37 residents & 159 000 DZD)
    const bldgSeedLock = await sql`
      INSERT INTO gest_meta (key, value)
      VALUES ('building_seeded', '1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `;
    if (bldgSeedLock.length > 0) {
      const bCnt = await sql`SELECT COUNT(*)::int AS cnt FROM gest_buildings`;
      if ((bCnt[0]?.cnt || 0) === 0) {
        const bId = INITIAL_BUILDING_DATA.building?.id || 'bldg-e36';
        const now = new Date().toISOString();
        await sql`
          INSERT INTO gest_buildings (id, payload, updated_at)
          VALUES (${bId}, ${JSON.stringify(INITIAL_BUILDING_DATA)}::jsonb, ${now})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }

    // One-time carry-over of 2025 deficit balance (-50 250 DZD) into 2026 exercise
    const ran2025Lock = await sql`
      INSERT INTO gest_meta (key, value)
      VALUES ('ran_2025_50250_v1', '1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `;
    if (ran2025Lock.length > 0) {
      const bRows = await sql`SELECT id, payload FROM gest_buildings WHERE id = 'bldg-e36' LIMIT 1`;
      if (bRows[0]) {
        const state = parsePayload(bRows[0].payload);
        if (state && Array.isArray(state.transactions) && !state.transactions.some((t) => t.id === 'tx-ran-2025')) {
          const ranTx = {
            id: 'tx-ran-2025',
            date: '2026-01-01',
            type: 'depense',
            fund: 'courant',
            category: 'Report à Nouveau (Solde Antérieur)',
            amountDZD: 50250,
            description: 'Report à nouveau débiteur — Solde Exercice 2025 (-50 250 DZD)',
            referenceDoc: 'RAN-2025',
            paymentMethod: 'Espèces',
          };
          const nextState = {
            ...state,
            transactions: [...state.transactions, ranTx],
          };
          await sql`
            UPDATE gest_buildings
            SET payload = ${JSON.stringify(nextState)}::jsonb, updated_at = ${new Date().toISOString()}
            WHERE id = 'bldg-e36'
          `;
          await writeAuditLog(
            sql,
            'bldg-e36',
            { fullName: 'Système', role: 'president' },
            'ADD_EXPENSE',
            'transaction',
            'tx-ran-2025',
            ranTx.description,
            ranTx.amountDZD
          );
        }
      }
    }

    // One-time sync of notice not-01 to reflect resolved elevator status (2/2 operational)
    const noticeSyncLock = await sql`
      INSERT INTO gest_meta (key, value)
      VALUES ('notice_01_elevator_sync_v1', '1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `;
    if (noticeSyncLock.length > 0) {
      const bRows = await sql`SELECT id, payload FROM gest_buildings WHERE id = 'bldg-e36' LIMIT 1`;
      if (bRows[0]) {
        const state = parsePayload(bRows[0].payload);
        if (state && Array.isArray(state.notices)) {
          let changed = false;
          const nextNotices = state.notices.map((n) => {
            if (n.id !== 'not-01') return n;
            changed = true;
            return {
              ...n,
              title: "Remise en service de l'Ascenseur N°1 (Gauche)",
              type: 'info',
              date: '2026-11-23',
              message:
                "Suite au remplacement du contacteur de porte et du galet de guidage par la société de maintenance, l'ascenseur N°1 (Gauche) est de nouveau pleinement opérationnel. Les 2 cabines sont en service normal.",
            };
          });
          if (changed) {
            await sql`
              UPDATE gest_buildings
              SET payload = ${JSON.stringify({ ...state, notices: nextNotices })}::jsonb,
                  updated_at = ${new Date().toISOString()}
              WHERE id = 'bldg-e36'
            `;
          }
        }
      }
    }

    // One-time removal of preventive maintenance tasks across buildings
    const clearPrevLock = await sql`
      INSERT INTO gest_meta (key, value)
      VALUES ('clear_preventive_tasks_v1', '1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `;
    if (clearPrevLock.length > 0) {
      const allBldgs = await sql`SELECT id, payload FROM gest_buildings`;
      for (const bRow of allBldgs) {
        const bState = parsePayload(bRow.payload);
        if (bState && Array.isArray(bState.preventiveTasks) && bState.preventiveTasks.length > 0) {
          await sql`
            UPDATE gest_buildings
            SET payload = ${JSON.stringify({ ...bState, preventiveTasks: [] })}::jsonb,
                updated_at = ${new Date().toISOString()}
            WHERE id = ${bRow.id}
          `;
        }
      }
    }

    return cachedSessionSecret;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

async function writeAuditLog(sql, buildingId, actor, action, entityType, entityId, summary, amountDZD = null) {
  const id = `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  await sql`
    INSERT INTO gest_audit_logs (id, building_id, timestamp, actor_name, actor_role, action, entity_type, entity_id, summary, amount_dzd)
    VALUES (
      ${id},
      ${buildingId},
      ${new Date().toISOString()},
      ${actor?.fullName || 'Système'},
      ${actor?.role || 'president'},
      ${action},
      ${entityType},
      ${entityId || null},
      ${summary},
      ${amountDZD !== undefined && amountDZD !== null ? Number(amountDZD) : null}
    )
  `;
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

function checkResidentReportRateLimit(request) {
  const ip =
    String(request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() ||
    request.headers.get('x-real-ip') ||
    'edge';
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

function checkResidentChatRateLimit(request) {
  const ip =
    String(request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() ||
    request.headers.get('x-real-ip') ||
    'edge';
  const now = Date.now();
  const recent = (residentChatBuckets.get(ip) || []).filter((ts) => now - ts < RESIDENT_CHAT_WINDOW_MS);
  if (recent.length >= RESIDENT_CHAT_MAX) {
    residentChatBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  residentChatBuckets.set(ip, recent);
  return true;
}

function computeNextDueDateServer(baseDateStr, frequency) {
  const base = new Date(baseDateStr);
  const d = isNaN(base.getTime()) ? new Date() : base;
  if (frequency === 'hebdomadaire') d.setDate(d.getDate() + 7);
  else if (frequency === 'mensuel') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'trimestriel') d.setMonth(d.getMonth() + 3);
  else if (frequency === 'semestriel') d.setMonth(d.getMonth() + 6);
  else if (frequency === 'annuel') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

async function readJsonBody(request, maxBytes = 4 * 1024 * 1024) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw new Error('Payload too large');
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Invalid JSON');
  }
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function getRequestActor(sql, request, sessionSecret) {
  const authHeader = request.headers.get('authorization') || '';
  let token = null;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(request.headers.get('cookie'));
    token = cookies.gest_aadl_session || null;
  }
  if (!token) return RESIDENT_ACTOR;
  const payload = verifyToken(token, sessionSecret);
  if (!payload?.userId) return RESIDENT_ACTOR;
  const rows = await sql`
    SELECT id, username, full_name, role, is_default_password
    FROM gest_users
    WHERE id = ${payload.userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return RESIDENT_ACTOR;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    isDefaultPassword: Boolean(row.is_default_password),
  };
}

async function listBuildings(sql) {
  const rows = await sql`SELECT id, payload FROM gest_buildings ORDER BY updated_at ASC, id ASC`;
  return rows.map((r) => {
    const b = parsePayload(r.payload)?.building || {};
    return {
      id: r.id,
      buildingNumber: b.buildingNumber,
      residenceName: b.residenceName,
      wilaya: b.wilaya,
      ilot: b.ilot,
    };
  });
}

async function getDefaultBuildingId(sql) {
  const rows = await sql`SELECT id FROM gest_buildings ORDER BY updated_at ASC, id ASC LIMIT 1`;
  return rows[0]?.id || 'bldg-e36';
}

async function getBuildingState(sql, buildingId) {
  const rows = await sql`SELECT payload FROM gest_buildings WHERE id = ${buildingId} LIMIT 1`;
  if (!rows[0]) return null;
  return parsePayload(rows[0].payload);
}

async function saveBuildingState(sql, buildingId, nextState) {
  const payload = {
    ...nextState,
    building: {
      ...nextState.building,
      id: buildingId,
    },
  };
  await sql`
    INSERT INTO gest_buildings (id, payload, updated_at)
    VALUES (${buildingId}, ${JSON.stringify(payload)}::jsonb, ${new Date().toISOString()})
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
  `;
  return payload;
}

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);
    const overridePath = reqUrl.searchParams.get('__path');
    const urlPath =
      overridePath !== null
        ? `/api/${overridePath.replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/api'
        : reqUrl.pathname.replace(/\/+$/, '') || '/';
    const method = request.method || 'GET';

    const sql = getSql();
    if (!sql) {
      if (urlPath === '/api/health') {
        return jsonResponse(
          {
            ok: false,
            configured: false,
            error: 'Neon Postgres non configuré (DATABASE_URL manquant)',
          },
          503
        );
      }
      // Return non-JSON 503 so frontend gracefully falls back to localStorage mode until Neon is linked
      return new Response('Neon Postgres not configured', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    try {
      const sessionSecret = await ensureInitialized(sql);
      const actor = await getRequestActor(sql, request, sessionSecret);
      const buildingId = reqUrl.searchParams.get('buildingId') || (await getDefaultBuildingId(sql));

      // Health
      if (urlPath === '/api/health' && method === 'GET') {
        const bCnt = await sql`SELECT COUNT(*)::int AS cnt FROM gest_buildings`;
        return jsonResponse({
          ok: true,
          mode: 'neon-postgres',
          hasData: (bCnt[0]?.cnt || 0) > 0,
        });
      }

      // Auth
      if (urlPath === '/api/auth/status' && method === 'GET') {
        return jsonResponse({
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
        const body = await readJsonBody(request);
        const cleanUser = String(body.username || 'president').trim().toLowerCase();
        const rows = await sql`
          SELECT id, username, full_name, role, salt, password_hash, is_default_password
          FROM gest_users
          WHERE LOWER(username) = ${cleanUser}
          LIMIT 1
        `;
        const row = rows[0];
        if (!row) {
          return jsonResponse({ error: 'Identifiant ou mot de passe incorrect.' }, 401);
        }
        const computed = hashPassword(String(body.password || ''), row.salt);
        const a = Buffer.from(computed, 'hex');
        const b = Buffer.from(row.password_hash, 'hex');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return jsonResponse({ error: 'Identifiant ou mot de passe incorrect.' }, 401);
        }
        const token = signToken(
          { userId: row.id, role: row.role, exp: Date.now() + SESSION_TTL_MS },
          sessionSecret
        );
        return jsonResponse(
          {
            role: row.role,
            user: { id: row.id, username: row.username, fullName: row.full_name, role: row.role },
            isDefaultPassword: Boolean(row.is_default_password),
            token,
          },
          200,
          {
            'Set-Cookie': `gest_aadl_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
          }
        );
      }

      if (urlPath === '/api/auth/logout' && method === 'POST') {
        return jsonResponse(
          { role: 'resident' },
          200,
          { 'Set-Cookie': 'gest_aadl_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0' }
        );
      }

      if (urlPath === '/api/auth/password' && method === 'POST') {
        if (actor.role === 'resident') {
          return jsonResponse({ error: 'Accès réservé aux membres du Bureau.' }, 403);
        }
        const body = await readJsonBody(request);
        const rows = await sql`SELECT id, salt, password_hash FROM gest_users WHERE id = ${actor.id} LIMIT 1`;
        const row = rows[0];
        if (!row) return jsonResponse({ error: 'Compte introuvable.' }, 400);
        const currHash = hashPassword(String(body.currentPassword || ''), row.salt);
        if (currHash !== row.password_hash) {
          return jsonResponse({ error: 'Mot de passe actuel incorrect.' }, 400);
        }
        const nextPwd = String(body.newPassword || '').trim();
        if (nextPwd.length < 6) {
          return jsonResponse({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' }, 400);
        }
        const newSalt = crypto.randomBytes(16).toString('hex');
        const newHash = hashPassword(nextPwd, newSalt);
        await sql`
          UPDATE gest_users
          SET salt = ${newSalt}, password_hash = ${newHash}, is_default_password = FALSE
          WHERE id = ${actor.id}
        `;
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          'CHANGE_PASSWORD',
          'user',
          actor.id,
          `Mot de passe modifié pour @${actor.username}`
        );
        return jsonResponse({ ok: true });
      }

      // Users RBAC
      if (urlPath === '/api/users' && method === 'GET') {
        if (actor.role !== 'president') return jsonResponse({ error: 'Réservé au Président du Syndic.' }, 403);
        const users = await sql`
          SELECT id, username, full_name AS "fullName", role, created_at AS "createdAt"
          FROM gest_users
          ORDER BY created_at ASC
        `;
        return jsonResponse({ users });
      }

      if (urlPath === '/api/users' && method === 'POST') {
        if (actor.role !== 'president') return jsonResponse({ error: 'Réservé au Président du Syndic.' }, 403);
        const body = await readJsonBody(request);
        const cleanUsername = String(body.username || '').trim().toLowerCase();
        if (cleanUsername.length < 3) {
          return jsonResponse({ error: "L'identifiant doit contenir au moins 3 caractères." }, 400);
        }
        if (!['president', 'treasurer', 'technical'].includes(body.role)) {
          return jsonResponse({ error: 'Rôle invalide.' }, 400);
        }
        if (!body.password || String(body.password).trim().length < 6) {
          return jsonResponse({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, 400);
        }
        const existing = await sql`SELECT id FROM gest_users WHERE LOWER(username) = ${cleanUsername} LIMIT 1`;
        if (existing.length > 0) {
          return jsonResponse({ error: 'Cet identifiant existe déjà.' }, 400);
        }
        const id = `usr-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
        const salt = crypto.randomBytes(16).toString('hex');
        const now = new Date().toISOString();
        const fullName = String(body.fullName || cleanUsername).trim();
        await sql`
          INSERT INTO gest_users (id, username, full_name, role, salt, password_hash, is_default_password, created_at)
          VALUES (${id}, ${cleanUsername}, ${fullName}, ${body.role}, ${salt}, ${hashPassword(String(body.password).trim(), salt)}, FALSE, ${now})
        `;
        await writeAuditLog(sql, buildingId, actor, 'CREATE_USER', 'user', id, `Création compte ${cleanUsername} (${body.role})`);
        return jsonResponse({ user: { id, username: cleanUsername, fullName, role: body.role, createdAt: now } }, 201);
      }

      if (urlPath.startsWith('/api/users/') && method === 'DELETE') {
        if (actor.role !== 'president') return jsonResponse({ error: 'Réservé au Président du Syndic.' }, 403);
        const targetId = decodeURIComponent(urlPath.slice('/api/users/'.length));
        if (targetId === actor.id) {
          return jsonResponse({ error: 'Impossible de supprimer votre propre compte actif.' }, 400);
        }
        const rows = await sql`SELECT id, username, role FROM gest_users WHERE id = ${targetId} LIMIT 1`;
        const target = rows[0];
        if (!target) return jsonResponse({ ok: false }, 404);
        if (target.role === 'president') {
          const pCnt = await sql`SELECT COUNT(*)::int AS cnt FROM gest_users WHERE role = 'president'`;
          if ((pCnt[0]?.cnt || 0) <= 1) {
            return jsonResponse({ error: 'Au moins un compte Président doit rester actif.' }, 400);
          }
        }
        await sql`DELETE FROM gest_users WHERE id = ${targetId}`;
        await writeAuditLog(sql, buildingId, actor, 'DELETE_USER', 'user', targetId, `Suppression compte ${target.username}`);
        return jsonResponse({ ok: true });
      }

      // Buildings & State
      if (urlPath === '/api/buildings' && method === 'GET') {
        return jsonResponse({ buildings: await listBuildings(sql) });
      }

      if (urlPath === '/api/buildings' && method === 'POST') {
        if (actor.role !== 'president') return jsonResponse({ error: 'Réservé au Président du Syndic.' }, 403);
        const body = await readJsonBody(request);
        if (!body?.data?.building) return jsonResponse({ error: 'Données bâtiment invalides.' }, 400);
        const newId = body.data.building.id || `bldg-${Date.now()}`;
        await saveBuildingState(sql, newId, body.data);
        await writeAuditLog(sql, newId, actor, 'BUILDING_SYNC', 'building', newId, `Création bâtiment ${body.data.building.buildingNumber}`);
        return jsonResponse({ ok: true, id: newId, buildings: await listBuildings(sql) }, 201);
      }

      if (urlPath === '/api/state' && method === 'GET') {
        const state = await getBuildingState(sql, buildingId);
        const payload = actor.role === 'resident' ? sanitizeDataForResident(state) : state;
        return jsonResponse({
          role: actor.role,
          buildingId,
          buildings: await listBuildings(sql),
          data: payload,
        });
      }

      if (urlPath === '/api/state/init' && method === 'POST') {
        const bCnt = await sql`SELECT COUNT(*)::int AS cnt FROM gest_buildings`;
        if ((bCnt[0]?.cnt || 0) > 0) {
          return jsonResponse({ ok: true, alreadyInitialized: true });
        }
        const body = await readJsonBody(request);
        if (!body?.data?.building || !Array.isArray(body?.data?.apartments)) {
          return jsonResponse({ error: 'Structure initiale invalide.' }, 400);
        }
        const targetId = body.data.building.id || 'bldg-e36';
        await saveBuildingState(sql, targetId, body.data);
        await writeAuditLog(sql, targetId, actor, 'BUILDING_SYNC', 'building', targetId, `Initialisation bâtiment ${body.data.building.buildingNumber}`);
        return jsonResponse({ ok: true, buildingId: targetId }, 201);
      }

      if (urlPath === '/api/state' && method === 'PUT') {
        if (actor.role !== 'president') {
          return jsonResponse({ error: 'Restauration/import réservé au Président du Syndic.' }, 403);
        }
        const body = await readJsonBody(request);
        if (!body?.data?.building || !Array.isArray(body?.data?.apartments)) {
          return jsonResponse({ error: 'Données invalides.' }, 400);
        }
        const targetId = body.buildingId || buildingId || body.data.building.id || 'bldg-e36';
        await saveBuildingState(sql, targetId, body.data);
        await writeAuditLog(sql, targetId, actor, 'BUILDING_SYNC', 'building', targetId, `Import / Restauration complète (${body.data.building.buildingNumber})`);
        return jsonResponse({ ok: true, savedAt: new Date().toISOString() });
      }

      // Building Info
      if (urlPath === '/api/building' && method === 'PUT') {
        if (actor.role !== 'president') return jsonResponse({ error: 'Réservé au Président.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);
        const nextBuilding = { ...body.building, id: buildingId };
        await saveBuildingState(sql, buildingId, { ...state, building: nextBuilding });
        await writeAuditLog(sql, buildingId, actor, 'UPDATE_BUILDING', 'building', buildingId, `Mise à jour paramètres ${nextBuilding.buildingNumber}`);
        return jsonResponse({ ok: true, building: nextBuilding });
      }

      // Apartments
      if (urlPath.startsWith('/api/apartments/') && method === 'PUT') {
        if (!canFinance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const body = await readJsonBody(request);
        const apt = body.apartment;
        const state = await getBuildingState(sql, buildingId);
        if (!state || !apt?.id) return jsonResponse({ error: 'Logement invalide.' }, 400);
        const exists = (state.apartments || []).some((a) => a.id === apt.id);
        const nextApts = exists
          ? state.apartments.map((a) => (a.id === apt.id ? apt : a))
          : [...(state.apartments || []), apt];
        await saveBuildingState(sql, buildingId, { ...state, apartments: nextApts });
        await writeAuditLog(sql, buildingId, actor, 'UPDATE_APARTMENT', 'apartment', apt.id, `Fiche ${apt.number} (${apt.resident?.name || ''}) modifiée`);
        return jsonResponse({ ok: true, apartment: apt });
      }

      // Payments
      if (urlPath === '/api/payments' && method === 'POST') {
        if (!canFinance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Trésorier.' }, 403);
        const body = await readJsonBody(request);
        const payment = body.payment;
        if (!payment?.id) return jsonResponse({ error: 'Paiement invalide.' }, 400);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);
        const tx = {
          id: `tx-rec-${payment.id}`,
          date: String(payment.paymentDate || new Date().toISOString()).slice(0, 10),
          type: 'recette',
          fund: 'courant',
          category: 'Cotisations Copropriétaires',
          amountDZD: Number(payment.amountDZD),
          description: `Cotisation ${payment.month} - ${payment.apartmentNumber} (${payment.residentName})`,
          referenceDoc: payment.receiptNumber,
          paymentMethod: payment.paymentMethod,
        };
        await saveBuildingState(sql, buildingId, {
          ...state,
          payments: [payment, ...(state.payments || [])],
          transactions: [tx, ...(state.transactions || [])],
        });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          'RECORD_PAYMENT',
          'payment',
          payment.id,
          `Encaissement ${payment.receiptNumber} — ${payment.apartmentNumber} (${payment.month})`,
          payment.amountDZD
        );
        return jsonResponse({ ok: true, payment, transaction: tx }, 201);
      }

      if (urlPath.startsWith('/api/payments/') && method === 'PUT') {
        if (!canFinance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Trésorier.' }, 403);
        const paymentId = decodeURIComponent(urlPath.slice('/api/payments/'.length));
        const body = await readJsonBody(request);
        const payment = body.payment;
        if (!paymentId || !payment || !Number.isFinite(Number(payment.amountDZD)) || Number(payment.amountDZD) <= 0) {
          return jsonResponse({ error: 'Cotisation ou montant invalide.' }, 400);
        }
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);
        const oldPayment = (state.payments || []).find((p) => p.id === paymentId);
        if (!oldPayment) return jsonResponse({ error: 'Cotisation introuvable.' }, 404);
        const updatedPayment = {
          ...oldPayment,
          ...payment,
          id: paymentId,
          amountDZD: Number(payment.amountDZD),
        };
        const updatedTx = {
          id: `tx-rec-${paymentId}`,
          date: String(updatedPayment.paymentDate || new Date().toISOString()).slice(0, 10),
          type: 'recette',
          fund: 'courant',
          category: 'Cotisations Copropriétaires',
          amountDZD: Number(updatedPayment.amountDZD),
          description: `Cotisation ${updatedPayment.month} - ${updatedPayment.apartmentNumber} (${updatedPayment.residentName})`,
          referenceDoc: updatedPayment.receiptNumber,
          paymentMethod: updatedPayment.paymentMethod,
        };
        const existingTxs = state.transactions || [];
        let matchedTx = false;
        const nextTransactions = existingTxs.map((t) => {
          const isMatch =
            t.id === `tx-rec-${paymentId}` ||
            Boolean(oldPayment.receiptNumber && t.type === 'recette' && t.referenceDoc === oldPayment.receiptNumber);
          if (isMatch) {
            matchedTx = true;
            return { ...t, ...updatedTx, id: t.id };
          }
          return t;
        });
        await saveBuildingState(sql, buildingId, {
          ...state,
          payments: (state.payments || []).map((p) => (p.id === paymentId ? updatedPayment : p)),
          transactions: matchedTx ? nextTransactions : [updatedTx, ...nextTransactions],
        });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          'UPDATE_PAYMENT',
          'payment',
          paymentId,
          `Modification cotisation ${updatedPayment.receiptNumber} — ${updatedPayment.apartmentNumber} (${updatedPayment.month})`,
          updatedPayment.amountDZD
        );
        return jsonResponse({ ok: true, payment: updatedPayment, transaction: updatedTx });
      }

      if (urlPath.startsWith('/api/payments/') && method === 'DELETE') {
        if (!canFinance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Trésorier.' }, 403);
        const paymentId = decodeURIComponent(urlPath.slice('/api/payments/'.length));
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ ok: false, error: 'Bâtiment introuvable.' }, 404);
        const targetPayment = (state.payments || []).find((p) => p.id === paymentId);
        if (!targetPayment) return jsonResponse({ ok: false, error: 'Cotisation introuvable.' }, 404);
        await saveBuildingState(sql, buildingId, {
          ...state,
          payments: (state.payments || []).filter((p) => p.id !== paymentId),
          transactions: (state.transactions || []).filter(
            (t) =>
              t.id !== `tx-rec-${paymentId}` &&
              !(targetPayment.receiptNumber && t.type === 'recette' && t.referenceDoc === targetPayment.receiptNumber)
          ),
        });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          'DELETE_PAYMENT',
          'payment',
          paymentId,
          `Suppression cotisation ${targetPayment.receiptNumber} — ${targetPayment.apartmentNumber} (${targetPayment.month})`,
          targetPayment.amountDZD
        );
        return jsonResponse({ ok: true });
      }

      // Transactions & Budget
      if (urlPath === '/api/transactions' && method === 'POST') {
        if (!canFinance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Trésorier.' }, 403);
        const body = await readJsonBody(request);
        if (!body?.transaction?.id) return jsonResponse({ error: 'Transaction invalide.' }, 400);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);
        const cleanTx = {
          ...body.transaction,
          fund: body.transaction.fund || 'courant',
          amountDZD: Number(body.transaction.amountDZD),
        };
        await saveBuildingState(sql, buildingId, {
          ...state,
          transactions: [cleanTx, ...(state.transactions || [])],
        });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          cleanTx.type === 'recette' ? 'ADD_INCOME' : 'ADD_EXPENSE',
          'transaction',
          cleanTx.id,
          `${cleanTx.category} : ${cleanTx.description}`,
          cleanTx.amountDZD
        );
        return jsonResponse({ ok: true, transaction: cleanTx }, 201);
      }

      if (urlPath.startsWith('/api/transactions/') && method === 'PUT') {
        if (!canFinance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Trésorier.' }, 403);
        const txId = decodeURIComponent(urlPath.slice('/api/transactions/'.length));
        const body = await readJsonBody(request);
        const tx = body?.transaction;
        if (!txId || !tx || !Number.isFinite(Number(tx.amountDZD)) || Number(tx.amountDZD) <= 0) {
          return jsonResponse({ error: 'Opération ou montant invalide.' }, 400);
        }
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);
        const oldTx = (state.transactions || []).find((t) => t.id === txId);
        if (!oldTx) return jsonResponse({ error: 'Opération introuvable.' }, 404);
        const updatedTx = {
          ...oldTx,
          ...tx,
          id: txId,
          fund: tx.fund || oldTx.fund || 'courant',
          amountDZD: Number(tx.amountDZD),
        };
        const linkedPaymentId = txId.startsWith('tx-rec-') ? txId.slice(7) : null;
        const nextPayments = linkedPaymentId
          ? (state.payments || []).map((p) =>
              p.id === linkedPaymentId
                ? {
                    ...p,
                    amountDZD: updatedTx.amountDZD,
                    paymentMethod: updatedTx.paymentMethod || p.paymentMethod,
                    paymentDate: updatedTx.date || p.paymentDate,
                  }
                : p
            )
          : state.payments || [];
        await saveBuildingState(sql, buildingId, {
          ...state,
          payments: nextPayments,
          transactions: (state.transactions || []).map((t) => (t.id === txId ? updatedTx : t)),
        });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          'UPDATE_TRANSACTION',
          'transaction',
          txId,
          `Modification écriture : ${updatedTx.description}`,
          updatedTx.amountDZD
        );
        return jsonResponse({ ok: true, transaction: updatedTx });
      }

      if (urlPath.startsWith('/api/transactions/') && method === 'DELETE') {
        if (!canFinance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Trésorier.' }, 403);
        const txId = decodeURIComponent(urlPath.slice('/api/transactions/'.length));
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ ok: false, error: 'Bâtiment introuvable.' }, 404);
        const targetTx = (state.transactions || []).find((t) => t.id === txId);
        if (!targetTx) return jsonResponse({ ok: false, error: 'Opération introuvable.' }, 404);
        const linkedPaymentId = txId.startsWith('tx-rec-') ? txId.slice(7) : null;
        await saveBuildingState(sql, buildingId, {
          ...state,
          payments: linkedPaymentId
            ? (state.payments || []).filter((p) => p.id !== linkedPaymentId)
            : state.payments || [],
          transactions: (state.transactions || []).filter((t) => t.id !== txId),
        });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          'DELETE_TRANSACTION',
          'transaction',
          txId,
          `Suppression écriture : ${targetTx.description}`,
          targetTx.amountDZD
        );
        return jsonResponse({ ok: true });
      }

      if (urlPath === '/api/budget' && method === 'PUT') {
        if (!canFinance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Trésorier.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);
        const plan = body.budgetPlan || [];
        await saveBuildingState(sql, buildingId, { ...state, budgetPlan: plan });
        await writeAuditLog(sql, buildingId, actor, 'UPDATE_BUDGET', 'budget', buildingId, 'Mise à jour du budget prévisionnel annuel');
        return jsonResponse({ ok: true, budgetPlan: plan });
      }

      // Uploads (inline DataURL stored safely in Postgres JSONB transaction)
      if (urlPath === '/api/uploads' && method === 'POST') {
        if (!canGovernance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const body = await readJsonBody(request, 4 * 1024 * 1024);
        const rawDataUrl = String(body.dataUrl || '');
        const match = rawDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
          return jsonResponse({ error: 'Format de fichier non autorisé (PNG, JPG, WEBP ou PDF uniquement).' }, 400);
        }
        const buf = Buffer.from(match[2], 'base64');
        if (buf.length > 2.5 * 1024 * 1024) {
          return jsonResponse({ error: 'Fichier trop volumineux (max 2,5 Mo).' }, 400);
        }
        const filename = String(body.filename || 'piece-jointe').split(/[/\\]/).pop() || 'piece-jointe';
        return jsonResponse({ ok: true, url: rawDataUrl, name: filename }, 201);
      }

      // Resident Public Incident Report
      if (urlPath === '/api/incidents/report' && method === 'POST') {
        if (!checkResidentReportRateLimit(request)) {
          return jsonResponse(
            { error: 'Trop de signalements récents. Veuillez patienter quelques minutes avant de réessayer.' },
            429
          );
        }
        const body = await readJsonBody(request);
        const raw = body?.report || body || {};
        const title = String(raw.title || '').trim().slice(0, 140);
        const location = String(raw.location || '').trim().slice(0, 120);
        const description = String(raw.description || '').trim().slice(0, 1000);
        const reportedBy = String(raw.reportedBy || '').trim().slice(0, 80);
        const category = ALLOWED_INCIDENT_CATEGORIES.has(raw.category) ? raw.category : 'autre';
        const priority = ALLOWED_INCIDENT_PRIORITIES.has(raw.priority) ? raw.priority : 'normale';
        const floorNum = Number.isFinite(Number(raw.floor)) ? Math.max(0, Math.min(30, Math.trunc(Number(raw.floor)))) : 0;

        if (title.length < 3) {
          return jsonResponse({ error: 'Veuillez indiquer un intitulé clair (au moins 3 caractères).' }, 400);
        }
        if (location.length < 2) {
          return jsonResponse({ error: 'Veuillez préciser le lieu ou la zone concernée.' }, 400);
        }

        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);

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

        await saveBuildingState(sql, buildingId, {
          ...state,
          incidents: [cleanIncident, ...(state.incidents || [])],
        });
        await writeAuditLog(
          sql,
          buildingId,
          { fullName: cleanIncident.reportedBy, role: 'resident' },
          'REPORT_INCIDENT',
          'incident',
          cleanIncident.id,
          `Signalement panne : ${cleanIncident.title} (${cleanIncident.location})`
        );
        return jsonResponse({ ok: true, incident: cleanIncident }, 201);
      }

      // Incidents & Quotes
      if (urlPath === '/api/incidents' && method === 'POST') {
        if (!canMaintenance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Resp. Technique.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state || !body?.incident?.id) return jsonResponse({ error: 'Incident invalide.' }, 400);
        await saveBuildingState(sql, buildingId, {
          ...state,
          incidents: [body.incident, ...(state.incidents || [])],
        });
        await writeAuditLog(sql, buildingId, actor, 'REPORT_INCIDENT', 'incident', body.incident.id, `Signalement panne : ${body.incident.title} (${body.incident.location})`);
        return jsonResponse({ ok: true, incident: body.incident }, 201);
      }

      const incQuoteSelectMatch = urlPath.match(/^\/api\/incidents\/([^/]+)\/quotes\/([^/]+)\/select$/);
      if (incQuoteSelectMatch && method === 'PATCH') {
        if (!canMaintenance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const incId = decodeURIComponent(incQuoteSelectMatch[1]);
        const quoteId = decodeURIComponent(incQuoteSelectMatch[2]);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ ok: false }, 404);
        let updatedInc = null;
        let pickedQuote = null;
        const nextIncidents = (state.incidents || []).map((inc) => {
          if (inc.id !== incId) return inc;
          const quotes = (inc.quotes || []).map((q) => ({ ...q, selected: q.id === quoteId }));
          pickedQuote = quotes.find((q) => q.id === quoteId);
          updatedInc = {
            ...inc,
            quotes,
            assignedVendor: pickedQuote ? pickedQuote.vendorName : inc.assignedVendor,
            estimatedCostDZD: pickedQuote ? pickedQuote.amountDZD : inc.estimatedCostDZD,
          };
          return updatedInc;
        });
        if (!updatedInc) return jsonResponse({ ok: false }, 404);
        await saveBuildingState(sql, buildingId, { ...state, incidents: nextIncidents });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          'SELECT_QUOTE',
          'incident',
          incId,
          `Devis retenu : ${pickedQuote?.vendorName || quoteId}`,
          pickedQuote?.amountDZD || null
        );
        return jsonResponse({ ok: true, incident: updatedInc });
      }

      const incQuoteMatch = urlPath.match(/^\/api\/incidents\/([^/]+)\/quotes$/);
      if (incQuoteMatch && method === 'POST') {
        if (!canMaintenance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const incId = decodeURIComponent(incQuoteMatch[1]);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state || !body?.quote) return jsonResponse({ ok: false }, 404);
        let updatedInc = null;
        const nextIncidents = (state.incidents || []).map((inc) => {
          if (inc.id !== incId) return inc;
          updatedInc = { ...inc, quotes: [...(inc.quotes || []), body.quote] };
          return updatedInc;
        });
        if (!updatedInc) return jsonResponse({ ok: false }, 404);
        await saveBuildingState(sql, buildingId, { ...state, incidents: nextIncidents });
        await writeAuditLog(sql, buildingId, actor, 'ADD_QUOTE', 'incident', incId, `Devis ajouté (${body.quote.vendorName})`, body.quote.amountDZD);
        return jsonResponse({ ok: true, incident: updatedInc });
      }

      const incMessagesMatch = urlPath.match(/^\/api\/incidents\/([^/]+)\/messages$/);
      if (incMessagesMatch && method === 'GET') {
        const incId = decodeURIComponent(incMessagesMatch[1]);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ ok: false, error: 'Bâtiment introuvable.' }, 404);
        const target = (state.incidents || []).find((inc) => inc.id === incId);
        if (!target) return jsonResponse({ ok: false, error: 'Incident introuvable.' }, 404);
        return jsonResponse({
          ok: true,
          messages: target.messages || [],
          status: target.status,
          assignedVendor: target.assignedVendor,
          resolutionNotes: target.resolutionNotes,
        });
      }

      if (incMessagesMatch && method === 'POST') {
        const incId = decodeURIComponent(incMessagesMatch[1]);
        if (actor.role === 'resident' && !checkResidentChatRateLimit(request)) {
          return jsonResponse(
            { error: 'Trop de messages envoyés récemment. Veuillez patienter quelques instants.' },
            429
          );
        }
        const body = await readJsonBody(request);
        const text = String(body?.text || '').trim().slice(0, 800);
        if (!text) {
          return jsonResponse({ error: 'Veuillez saisir un message.' }, 400);
        }
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);
        const existingInc = (state.incidents || []).find((inc) => inc.id === incId);
        if (!existingInc) return jsonResponse({ error: 'Incident introuvable.' }, 404);

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

        let updatedInc = null;
        const nextIncidents = (state.incidents || []).map((inc) => {
          if (inc.id !== incId) return inc;
          updatedInc = {
            ...inc,
            messages: [...(inc.messages || []), newMessage].slice(-200),
          };
          return updatedInc;
        });

        await saveBuildingState(sql, buildingId, { ...state, incidents: nextIncidents });
        await writeAuditLog(
          sql,
          buildingId,
          isBureauSender ? actor : { fullName: senderName, role: 'resident' },
          'INCIDENT_MESSAGE',
          'incident',
          incId,
          `Message panne "${existingInc.title}" : ${text.slice(0, 80)}`
        );
        return jsonResponse({ ok: true, message: newMessage, incident: updatedInc }, 201);
      }

      const incPatchMatch = urlPath.match(/^\/api\/incidents\/([^/]+)$/);
      if (incPatchMatch && method === 'PATCH') {
        if (!canMaintenance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const incId = decodeURIComponent(incPatchMatch[1]);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ ok: false }, 404);
        let updatedInc = null;
        const statusMsgText =
          body.status === 'resolu'
            ? `Panne résolue${body.resolutionNotes ? ` : ${body.resolutionNotes}` : '.'}`
            : body.status === 'en_cours'
            ? 'Signalement pris en charge — intervention en cours.'
            : null;
        const nextIncidents = (state.incidents || []).map((inc) => {
          if (inc.id !== incId) return inc;
          const nextMessages = statusMsgText
            ? [
                ...(inc.messages || []),
                {
                  id: `msg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
                  senderRole: actor.role,
                  senderName: actor.fullName,
                  text: statusMsgText,
                  timestamp: new Date().toISOString(),
                },
              ].slice(-200)
            : inc.messages || [];
          updatedInc = {
            ...inc,
            status: body.status,
            actualCostDZD: body.actualCost !== undefined ? Number(body.actualCost) : inc.actualCostDZD,
            resolvedDate: body.status === 'resolu' ? new Date().toISOString() : inc.resolvedDate,
            resolutionNotes: body.resolutionNotes || inc.resolutionNotes,
            messages: nextMessages,
          };
          return updatedInc;
        });
        if (!updatedInc) return jsonResponse({ ok: false }, 404);
        let createdTx = null;
        let nextTxs = state.transactions || [];
        if (body.status === 'resolu' && body.actualCost && Number(body.actualCost) > 0) {
          createdTx = {
            id: `tx-inc-${incId}-${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            type: 'depense',
            fund: 'courant',
            category:
              updatedInc.category === 'ascenseur'
                ? 'Maintenance Ascenseurs'
                : updatedInc.category === 'surpresseur_eau'
                ? 'Réparation Bâche à Eau / Surpresseur'
                : 'Achat Fournitures & Ampoules',
            amountDZD: Number(body.actualCost),
            description: `Réparation clôturée : ${updatedInc.title}`,
            paymentMethod: 'Espèces',
          };
          nextTxs = [createdTx, ...nextTxs];
        }
        await saveBuildingState(sql, buildingId, {
          ...state,
          incidents: nextIncidents,
          transactions: nextTxs,
        });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          body.status === 'resolu' ? 'RESOLVE_INCIDENT' : 'UPDATE_INCIDENT',
          'incident',
          incId,
          `Incident "${updatedInc.title}" -> ${body.status}`,
          body.actualCost || null
        );
        return jsonResponse({ ok: true, incident: updatedInc, transaction: createdTx });
      }

      // Preventive Maintenance
      if (urlPath === '/api/preventive' && method === 'POST') {
        if (!canMaintenance(actor.role)) return jsonResponse({ error: 'Réservé au Président ou Resp. Technique.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state || !body?.task?.id) return jsonResponse({ error: 'Tâche invalide.' }, 400);
        await saveBuildingState(sql, buildingId, {
          ...state,
          preventiveTasks: [body.task, ...(state.preventiveTasks || [])],
        });
        await writeAuditLog(sql, buildingId, actor, 'ADD_PREVENTIVE', 'preventive', body.task.id, `Nouvelle tâche préventive : ${body.task.title}`);
        return jsonResponse({ ok: true, task: body.task }, 201);
      }

      const prevCompleteMatch = urlPath.match(/^\/api\/preventive\/([^/]+)\/complete$/);
      if (prevCompleteMatch && method === 'POST') {
        if (!canMaintenance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const taskId = decodeURIComponent(prevCompleteMatch[1]);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ ok: false }, 404);
        let updatedTask = null;
        const nextTasks = (state.preventiveTasks || []).map((task) => {
          if (task.id !== taskId) return task;
          updatedTask = {
            ...task,
            lastDoneDate: body.performedDate,
            nextDueDate: computeNextDueDateServer(body.performedDate, task.frequency),
            history: [
              { date: body.performedDate, performedBy: body.performedBy, costDZD: Number(body.costDZD) || 0, notes: body.notes },
              ...(task.history || []),
            ],
          };
          return updatedTask;
        });
        if (!updatedTask) return jsonResponse({ ok: false }, 404);
        let createdTx = null;
        let nextTxs = state.transactions || [];
        if (body.costDZD && Number(body.costDZD) > 0) {
          createdTx = {
            id: `tx-prev-${taskId}-${Date.now()}`,
            date: body.performedDate,
            type: 'depense',
            fund: 'courant',
            category:
              updatedTask.equipment === 'ascenseur'
                ? 'Maintenance Ascenseurs'
                : updatedTask.equipment === 'surpresseur_eau'
                ? 'Réparation Bâche à Eau / Surpresseur'
                : updatedTask.equipment === 'porte_interphone'
                ? 'Serrurerie & Interphone'
                : 'Achat Fournitures & Ampoules',
            amountDZD: Number(body.costDZD),
            description: `Entretien préventif : ${updatedTask.title} (${body.performedBy})`,
            paymentMethod: 'Espèces',
          };
          nextTxs = [createdTx, ...nextTxs];
        }
        await saveBuildingState(sql, buildingId, {
          ...state,
          preventiveTasks: nextTasks,
          transactions: nextTxs,
        });
        await writeAuditLog(
          sql,
          buildingId,
          actor,
          'COMPLETE_PREVENTIVE',
          'preventive',
          taskId,
          `Entretien validé : ${updatedTask.title} (${body.performedBy})`,
          body.costDZD || null
        );
        return jsonResponse({ ok: true, task: updatedTask, transaction: createdTx });
      }

      // Governance: Notices, Votes, Minutes, House Rules, Vendors
      if (urlPath === '/api/notices' && method === 'POST') {
        if (!canGovernance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state || !body?.notice?.id) return jsonResponse({ error: 'Avis invalide.' }, 400);
        await saveBuildingState(sql, buildingId, {
          ...state,
          notices: [body.notice, ...(state.notices || [])],
        });
        await writeAuditLog(sql, buildingId, actor, 'ADD_NOTICE', 'notice', body.notice.id, `Avis publié : ${body.notice.title}`);
        return jsonResponse({ ok: true, notice: body.notice }, 201);
      }

      if (urlPath === '/api/votes' && method === 'POST') {
        if (!canGovernance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state || !body?.vote?.id) return jsonResponse({ error: 'Vote invalide.' }, 400);
        await saveBuildingState(sql, buildingId, {
          ...state,
          votes: [body.vote, ...(state.votes || [])],
        });
        await writeAuditLog(sql, buildingId, actor, 'CREATE_VOTE', 'vote', body.vote.id, `Vote AG ouvert : ${body.vote.title}`);
        return jsonResponse({ ok: true, vote: body.vote }, 201);
      }

      const voteToggleMatch = urlPath.match(/^\/api\/votes\/([^/]+)\/toggle$/);
      if (voteToggleMatch && method === 'PATCH') {
        if (!canGovernance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const voteId = decodeURIComponent(voteToggleMatch[1]);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ ok: false }, 404);
        let updatedVote = null;
        const nextVotes = (state.votes || []).map((v) => {
          if (v.id !== voteId) return v;
          updatedVote = { ...v, status: v.status === 'active' ? 'closed' : 'active' };
          return updatedVote;
        });
        if (!updatedVote) return jsonResponse({ ok: false }, 404);
        await saveBuildingState(sql, buildingId, { ...state, votes: nextVotes });
        await writeAuditLog(sql, buildingId, actor, 'TOGGLE_VOTE', 'vote', voteId, `Vote "${updatedVote.title}" -> ${updatedVote.status}`);
        return jsonResponse({ ok: true, vote: updatedVote });
      }

      const voteCastMatch = urlPath.match(/^\/api\/votes\/([^/]+)\/cast$/);
      if (voteCastMatch && method === 'POST') {
        if (!canGovernance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const voteId = decodeURIComponent(voteCastMatch[1]);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Vote introuvable.' }, 400);
        const targetVote = (state.votes || []).find((v) => v.id === voteId);
        if (!targetVote) return jsonResponse({ error: 'Vote introuvable.' }, 400);
        if ((targetVote.votedApartments || []).includes(body.apartmentId)) {
          return jsonResponse({ error: 'Ce logement a déjà exprimé son vote pour cette consultation.' }, 400);
        }
        const updatedVote = {
          ...targetVote,
          votedApartments: [...(targetVote.votedApartments || []), body.apartmentId],
          options: (targetVote.options || []).map((o) =>
            o.id === body.optionId ? { ...o, votes: o.votes + 1 } : o
          ),
        };
        const nextVotes = (state.votes || []).map((v) => (v.id === voteId ? updatedVote : v));
        await saveBuildingState(sql, buildingId, { ...state, votes: nextVotes });
        await writeAuditLog(sql, buildingId, actor, 'CAST_VOTE', 'vote', voteId, `Vote enregistré pour ${body.apartmentId} (${targetVote.title})`);
        return jsonResponse({ ok: true, vote: updatedVote });
      }

      if (urlPath === '/api/minutes' && method === 'POST') {
        if (!canGovernance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state || !body?.minutes?.id) return jsonResponse({ error: 'PV invalide.' }, 400);
        await saveBuildingState(sql, buildingId, {
          ...state,
          assemblyMinutes: [body.minutes, ...(state.assemblyMinutes || [])],
        });
        await writeAuditLog(sql, buildingId, actor, 'ADD_MINUTES', 'minutes', body.minutes.id, `PV d'AG enregistré : ${body.minutes.title}`);
        return jsonResponse({ ok: true, minutes: body.minutes }, 201);
      }

      if (urlPath === '/api/rules' && method === 'PUT') {
        if (!canGovernance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state) return jsonResponse({ error: 'Bâtiment introuvable.' }, 404);
        const rules = body.houseRules || [];
        await saveBuildingState(sql, buildingId, { ...state, houseRules: rules });
        await writeAuditLog(sql, buildingId, actor, 'UPDATE_RULES', 'rules', buildingId, 'Règlement intérieur mis à jour');
        return jsonResponse({ ok: true, houseRules: rules });
      }

      if (urlPath === '/api/vendors' && method === 'POST') {
        if (!canGovernance(actor.role)) return jsonResponse({ error: 'Accès refusé.' }, 403);
        const body = await readJsonBody(request);
        const state = await getBuildingState(sql, buildingId);
        if (!state || !body?.vendor?.id) return jsonResponse({ error: 'Prestataire invalide.' }, 400);
        await saveBuildingState(sql, buildingId, {
          ...state,
          vendors: [...(state.vendors || []), body.vendor],
        });
        await writeAuditLog(sql, buildingId, actor, 'ADD_VENDOR', 'vendor', body.vendor.id, `Prestataire ajouté : ${body.vendor.name}`);
        return jsonResponse({ ok: true, vendor: body.vendor }, 201);
      }

      if (urlPath === '/api/audit-logs' && method === 'GET') {
        if (actor.role === 'resident') return jsonResponse({ error: 'Accès réservé au Bureau Syndic.' }, 403);
        const limit = Math.max(1, Math.min(500, Number(reqUrl.searchParams.get('limit') || 150)));
        const logs = await sql`
          SELECT id, building_id AS "buildingId", timestamp, actor_name AS "actorName",
                 actor_role AS "actorRole", action, entity_type AS "entityType",
                 entity_id AS "entityId", summary, amount_dzd AS "amountDZD"
          FROM gest_audit_logs
          WHERE building_id = ${buildingId}
          ORDER BY timestamp DESC
          LIMIT ${limit}
        `;
        return jsonResponse({ logs });
      }

      return jsonResponse({ error: 'Route API introuvable.' }, 404);
    } catch (err) {
      console.error('[Gest-AADL Neon API Error]', err);
      return jsonResponse({ error: err?.message || 'Erreur serveur.' }, 400);
    }
  },
};
