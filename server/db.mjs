import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = process.env.GEST_AADL_DATA_DIR
  ? path.resolve(process.env.GEST_AADL_DATA_DIR)
  : path.join(ROOT_DIR, 'server', 'data');
export const UPLOADS_DIR = process.env.GEST_AADL_UPLOADS_DIR
  ? path.resolve(process.env.GEST_AADL_UPLOADS_DIR)
  : path.join(ROOT_DIR, 'server', 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const SQLITE_FILE = path.join(DATA_DIR, 'gest-aadl.sqlite');
const LEGACY_DB_FILE = path.join(DATA_DIR, 'database.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(SQLITE_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_default_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS apartments (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    floor INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    apartment_id TEXT NOT NULL,
    month TEXT NOT NULL,
    amount_dzd REAL NOT NULL,
    receipt_number TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    fund TEXT NOT NULL,
    category TEXT NOT NULL,
    amount_dzd REAL NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS incidents (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS preventive_tasks (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    next_due_date TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS notices (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    date TEXT NOT NULL,
    is_pinned INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS votes (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS assembly_minutes (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    date TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS budget_plans (
    building_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS house_rules (
    building_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vendors (
    building_id TEXT NOT NULL,
    id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL,
    PRIMARY KEY (building_id, id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT NOT NULL,
    amount_dzd REAL
  );
`);

export function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function getOrCreateSessionSecret() {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'session_secret'").get();
  if (row?.value) return row.value;
  const secret = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO meta (key, value) VALUES ('session_secret', ?)").run(secret);
  return secret;
}

function runInTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    ensureDailyBackup();
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function ensureDailyBackup() {
  const day = new Date().toISOString().slice(0, 10);
  const backupFile = path.join(BACKUP_DIR, `gest-aadl_${day}.sqlite`);
  if (!fs.existsSync(backupFile)) {
    try {
      fs.copyFileSync(SQLITE_FILE, backupFile);
    } catch {
      // ignore backup copy errors if file locked momentarily
    }
  }
}

export function writeAuditLog(buildingId, actor, action, entityType, entityId, summary, amountDZD = null) {
  const id = `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  db.prepare(
    `INSERT INTO audit_logs (id, building_id, timestamp, actor_name, actor_role, action, entity_type, entity_id, summary, amount_dzd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    buildingId,
    new Date().toISOString(),
    actor?.fullName || 'Système',
    actor?.role || 'president',
    action,
    entityType,
    entityId || null,
    summary,
    amountDZD !== undefined && amountDZD !== null ? Number(amountDZD) : null
  );
}

function seedDefaultUsersIfEmpty() {
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
  if (countRow && countRow.cnt > 0) return;

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

  const insertStmt = db.prepare(
    `INSERT INTO users (id, username, full_name, role, salt, password_hash, is_default_password, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  );
  const now = new Date().toISOString();
  for (const u of defaults) {
    const salt = crypto.randomBytes(16).toString('hex');
    insertStmt.run(u.id, u.username, u.fullName, u.role, salt, hashPassword(u.password, salt), now);
  }
}

export function insertBuildingBundle(buildingId, data, actor = { fullName: 'Migration / Init', role: 'president' }, logSummary = null) {
  const buildingPayload = {
    ...data.building,
    id: buildingId,
  };
  const now = new Date().toISOString();

  db.prepare('INSERT OR REPLACE INTO buildings (id, payload, updated_at) VALUES (?, ?, ?)').run(
    buildingId,
    JSON.stringify(buildingPayload),
    now
  );

  // Clear existing rows for buildingId
  const tablesToClear = [
    'apartments',
    'payments',
    'transactions',
    'incidents',
    'preventive_tasks',
    'notices',
    'votes',
    'assembly_minutes',
    'vendors',
  ];
  for (const table of tablesToClear) {
    db.prepare(`DELETE FROM ${table} WHERE building_id = ?`).run(buildingId);
  }

  const insApt = db.prepare('INSERT INTO apartments (building_id, id, floor, sort_order, payload) VALUES (?, ?, ?, ?, ?)');
  (data.apartments || []).forEach((apt, idx) => {
    insApt.run(buildingId, apt.id, Number(apt.floor || 0), idx, JSON.stringify(apt));
  });

  const insPay = db.prepare(
    'INSERT INTO payments (building_id, id, apartment_id, month, amount_dzd, receipt_number, payment_date, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const p of data.payments || []) {
    insPay.run(buildingId, p.id, p.apartmentId, p.month, Number(p.amountDZD || 0), p.receiptNumber, p.paymentDate, JSON.stringify(p));
  }

  const insTx = db.prepare(
    'INSERT INTO transactions (building_id, id, date, type, fund, category, amount_dzd, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const tx of data.transactions || []) {
    insTx.run(buildingId, tx.id, tx.date, tx.type, tx.fund || 'courant', tx.category, Number(tx.amountDZD || 0), JSON.stringify(tx));
  }

  const insInc = db.prepare('INSERT INTO incidents (building_id, id, status, priority, payload) VALUES (?, ?, ?, ?, ?)');
  for (const inc of data.incidents || []) {
    insInc.run(buildingId, inc.id, inc.status, inc.priority, JSON.stringify(inc));
  }

  const insPrev = db.prepare('INSERT INTO preventive_tasks (building_id, id, next_due_date, payload) VALUES (?, ?, ?, ?)');
  for (const task of data.preventiveTasks || []) {
    insPrev.run(buildingId, task.id, task.nextDueDate, JSON.stringify(task));
  }

  const insNot = db.prepare('INSERT INTO notices (building_id, id, date, is_pinned, payload) VALUES (?, ?, ?, ?, ?)');
  for (const n of data.notices || []) {
    insNot.run(buildingId, n.id, n.date, n.isPinned ? 1 : 0, JSON.stringify(n));
  }

  const insVote = db.prepare('INSERT INTO votes (building_id, id, status, payload) VALUES (?, ?, ?, ?)');
  for (const v of data.votes || []) {
    insVote.run(buildingId, v.id, v.status, JSON.stringify(v));
  }

  const insPv = db.prepare('INSERT INTO assembly_minutes (building_id, id, date, payload) VALUES (?, ?, ?, ?)');
  for (const m of data.assemblyMinutes || []) {
    insPv.run(buildingId, m.id, m.date, JSON.stringify(m));
  }

  db.prepare('INSERT OR REPLACE INTO budget_plans (building_id, payload) VALUES (?, ?)').run(
    buildingId,
    JSON.stringify(data.budgetPlan || [])
  );

  db.prepare('INSERT OR REPLACE INTO house_rules (building_id, payload) VALUES (?, ?)').run(
    buildingId,
    JSON.stringify(data.houseRules || [])
  );

  const insVen = db.prepare('INSERT INTO vendors (building_id, id, sort_order, payload) VALUES (?, ?, ?, ?)');
  (data.vendors || []).forEach((v, idx) => {
    insVen.run(buildingId, v.id, idx, JSON.stringify(v));
  });

  if (logSummary) {
    writeAuditLog(buildingId, actor, 'BUILDING_SYNC', 'building', buildingId, logSummary);
  }
}

function migrateLegacyJsonIfNeeded() {
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM buildings').get();
  if (cnt && cnt.cnt > 0) return;
  if (!fs.existsSync(LEGACY_DB_FILE)) return;

  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_DB_FILE, 'utf8'));
    if (legacy && legacy.building && Array.isArray(legacy.apartments)) {
      const buildingId = legacy.building.id || 'bldg-e36';
      runInTransaction(() => {
        insertBuildingBundle(
          buildingId,
          legacy,
          { fullName: 'Migration SQLite Automatique', role: 'president' },
          'Migration automatique depuis database.json vers SQLite'
        );
      });
      console.log(`[Gest-AADL DB] Migrated legacy database.json into SQLite (${buildingId}).`);
    }
  } catch (err) {
    console.error('[Gest-AADL DB] Failed to migrate legacy database.json:', err.message);
  }
}

function ensureRan2025Seeded() {
  const existingMeta = db.prepare("SELECT value FROM meta WHERE key = 'ran_2025_50250_v1'").get();
  if (existingMeta) return;
  runInTransaction(() => {
    db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('ran_2025_50250_v1', '1')").run();
    const bRow = db.prepare("SELECT id FROM buildings WHERE id = 'bldg-e36'").get();
    if (!bRow) return;
    const existsTx = db
      .prepare("SELECT id FROM transactions WHERE building_id = 'bldg-e36' AND id = 'tx-ran-2025'")
      .get();
    if (existsTx) return;
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
    db.prepare(
      `INSERT INTO transactions (building_id, id, date, type, fund, category, amount_dzd, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'bldg-e36',
      ranTx.id,
      ranTx.date,
      ranTx.type,
      ranTx.fund,
      ranTx.category,
      ranTx.amountDZD,
      JSON.stringify(ranTx)
    );
    writeAuditLog(
      'bldg-e36',
      { fullName: 'Système', role: 'president' },
      'ADD_EXPENSE',
      'transaction',
      ranTx.id,
      ranTx.description,
      ranTx.amountDZD
    );
  });
}

seedDefaultUsersIfEmpty();
migrateLegacyJsonIfNeeded();
ensureRan2025Seeded();

function ensureNotice01Synced() {
  const existingMeta = db.prepare("SELECT value FROM meta WHERE key = 'notice_01_elevator_sync_v1'").get();
  if (existingMeta) return;
  runInTransaction(() => {
    db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('notice_01_elevator_sync_v1', '1')").run();
    const row = db
      .prepare("SELECT payload FROM notices WHERE building_id = 'bldg-e36' AND id = 'not-01'")
      .get();
    if (!row) return;
    const notice = JSON.parse(row.payload);
    const updated = {
      ...notice,
      title: "Remise en service de l'Ascenseur N°1 (Gauche)",
      type: 'info',
      date: '2026-11-23',
      message:
        "Suite au remplacement du contacteur de porte et du galet de guidage par la société de maintenance, l'ascenseur N°1 (Gauche) est de nouveau pleinement opérationnel. Les 2 cabines sont en service normal.",
    };
    db.prepare("UPDATE notices SET date = ?, payload = ? WHERE building_id = 'bldg-e36' AND id = 'not-01'").run(
      updated.date,
      JSON.stringify(updated)
    );
  });
}

ensureNotice01Synced();
getOrCreateSessionSecret();

// --- Queries & Mutations ---

export function listBuildings() {
  const rows = db.prepare('SELECT id, payload FROM buildings ORDER BY rowid ASC').all();
  return rows.map((r) => {
    const b = JSON.parse(r.payload);
    return {
      id: r.id,
      buildingNumber: b.buildingNumber,
      residenceName: b.residenceName,
      wilaya: b.wilaya,
      ilot: b.ilot,
    };
  });
}

export function getDefaultBuildingId() {
  const row = db.prepare('SELECT id FROM buildings ORDER BY rowid ASC LIMIT 1').get();
  return row ? row.id : 'bldg-e36';
}

export function hasAnyBuilding() {
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM buildings').get();
  return Boolean(cnt && cnt.cnt > 0);
}

export function getBuildingState(buildingId) {
  const bRow = db.prepare('SELECT payload FROM buildings WHERE id = ?').get(buildingId);
  if (!bRow) return null;

  const building = JSON.parse(bRow.payload);
  const apartments = db
    .prepare('SELECT payload FROM apartments WHERE building_id = ? ORDER BY sort_order ASC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));
  const payments = db
    .prepare('SELECT payload FROM payments WHERE building_id = ? ORDER BY payment_date DESC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));
  const transactions = db
    .prepare('SELECT payload FROM transactions WHERE building_id = ? ORDER BY date DESC, rowid DESC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));
  const incidents = db
    .prepare('SELECT payload FROM incidents WHERE building_id = ? ORDER BY rowid DESC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));
  const preventiveTasks = db
    .prepare('SELECT payload FROM preventive_tasks WHERE building_id = ? ORDER BY next_due_date ASC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));
  const notices = db
    .prepare('SELECT payload FROM notices WHERE building_id = ? ORDER BY is_pinned DESC, date DESC, rowid DESC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));
  const votes = db
    .prepare('SELECT payload FROM votes WHERE building_id = ? ORDER BY rowid DESC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));
  const assemblyMinutes = db
    .prepare('SELECT payload FROM assembly_minutes WHERE building_id = ? ORDER BY date DESC, rowid DESC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));
  const vendors = db
    .prepare('SELECT payload FROM vendors WHERE building_id = ? ORDER BY sort_order ASC')
    .all(buildingId)
    .map((r) => JSON.parse(r.payload));

  const budgetRow = db.prepare('SELECT payload FROM budget_plans WHERE building_id = ?').get(buildingId);
  const rulesRow = db.prepare('SELECT payload FROM house_rules WHERE building_id = ?').get(buildingId);

  return {
    building,
    apartments,
    payments,
    incidents,
    transactions,
    notices,
    votes,
    vendors,
    budgetPlan: budgetRow ? JSON.parse(budgetRow.payload) : [],
    preventiveTasks,
    assemblyMinutes,
    houseRules: rulesRow ? JSON.parse(rulesRow.payload) : [],
  };
}

export function initializeBuildingIfEmpty(buildingId, data, actor) {
  return runInTransaction(() => {
    if (hasAnyBuilding()) return false;
    insertBuildingBundle(buildingId, data, actor, `Initialisation bâtiment ${data.building.buildingNumber}`);
    return true;
  });
}

export function createBuilding(data, actor) {
  const buildingId = data.building.id || `bldg-${Date.now()}`;
  return runInTransaction(() => {
    insertBuildingBundle(buildingId, data, actor, `Création bâtiment ${data.building.buildingNumber}`);
    return buildingId;
  });
}

export function replaceBuildingState(buildingId, data, actor) {
  return runInTransaction(() => {
    insertBuildingBundle(buildingId, data, actor, `Import / Restauration complète (${data.building.buildingNumber})`);
  });
}

export function updateBuildingInfo(buildingId, building, actor) {
  return runInTransaction(() => {
    const payload = { ...building, id: buildingId };
    db.prepare('UPDATE buildings SET payload = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(payload),
      new Date().toISOString(),
      buildingId
    );
    writeAuditLog(buildingId, actor, 'UPDATE_BUILDING', 'building', buildingId, `Mise à jour paramètres ${payload.buildingNumber}`);
    return payload;
  });
}

export function updateApartment(buildingId, apt, actor) {
  return runInTransaction(() => {
    const existing = db.prepare('SELECT sort_order FROM apartments WHERE building_id = ? AND id = ?').get(buildingId, apt.id);
    const sortOrder = existing ? existing.sort_order : 999;
    db.prepare('INSERT OR REPLACE INTO apartments (building_id, id, floor, sort_order, payload) VALUES (?, ?, ?, ?, ?)').run(
      buildingId,
      apt.id,
      Number(apt.floor || 0),
      sortOrder,
      JSON.stringify(apt)
    );
    writeAuditLog(buildingId, actor, 'UPDATE_APARTMENT', 'apartment', apt.id, `Fiche ${apt.number} (${apt.resident.name}) modifiée`);
    return apt;
  });
}

export function recordPaymentAtomic(buildingId, payment, actor) {
  return runInTransaction(() => {
    db.prepare(
      `INSERT INTO payments (building_id, id, apartment_id, month, amount_dzd, receipt_number, payment_date, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      buildingId,
      payment.id,
      payment.apartmentId,
      payment.month,
      Number(payment.amountDZD),
      payment.receiptNumber,
      payment.paymentDate,
      JSON.stringify(payment)
    );

    const tx = {
      id: `tx-rec-${payment.id}`,
      date: payment.paymentDate.slice(0, 10),
      type: 'recette',
      fund: 'courant',
      category: 'Cotisations Copropriétaires',
      amountDZD: Number(payment.amountDZD),
      description: `Cotisation ${payment.month} - ${payment.apartmentNumber} (${payment.residentName})`,
      referenceDoc: payment.receiptNumber,
      paymentMethod: payment.paymentMethod,
    };

    db.prepare(
      `INSERT INTO transactions (building_id, id, date, type, fund, category, amount_dzd, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(buildingId, tx.id, tx.date, tx.type, tx.fund, tx.category, tx.amountDZD, JSON.stringify(tx));

    writeAuditLog(
      buildingId,
      actor,
      'RECORD_PAYMENT',
      'payment',
      payment.id,
      `Encaissement ${payment.receiptNumber} — ${payment.apartmentNumber} (${payment.month})`,
      payment.amountDZD
    );

    return { payment, transaction: tx };
  });
}

export function updatePaymentAtomic(buildingId, paymentId, payment, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM payments WHERE building_id = ? AND id = ?').get(buildingId, paymentId);
    if (!row) return null;
    const oldPayment = JSON.parse(row.payload);
    const updatedPayment = {
      ...oldPayment,
      ...payment,
      id: paymentId,
      amountDZD: Number(payment.amountDZD),
    };

    db.prepare(
      `UPDATE payments
       SET apartment_id = ?, month = ?, amount_dzd = ?, receipt_number = ?, payment_date = ?, payload = ?
       WHERE building_id = ? AND id = ?`
    ).run(
      updatedPayment.apartmentId,
      updatedPayment.month,
      Number(updatedPayment.amountDZD),
      updatedPayment.receiptNumber,
      updatedPayment.paymentDate,
      JSON.stringify(updatedPayment),
      buildingId,
      paymentId
    );

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

    const txRows = db
      .prepare("SELECT id, payload FROM transactions WHERE building_id = ? AND type = 'recette'")
      .all(buildingId);
    let matchedTx = false;
    for (const txRow of txRows) {
      const parsedTx = JSON.parse(txRow.payload);
      const isMatch =
        txRow.id === `tx-rec-${paymentId}` ||
        Boolean(oldPayment.receiptNumber && parsedTx.referenceDoc === oldPayment.receiptNumber);
      if (isMatch) {
        matchedTx = true;
        const mergedTx = { ...parsedTx, ...updatedTx, id: txRow.id };
        db.prepare('UPDATE transactions SET date = ?, amount_dzd = ?, payload = ? WHERE building_id = ? AND id = ?').run(
          mergedTx.date,
          mergedTx.amountDZD,
          JSON.stringify(mergedTx),
          buildingId,
          txRow.id
        );
      }
    }
    if (!matchedTx) {
      db.prepare(
        `INSERT INTO transactions (building_id, id, date, type, fund, category, amount_dzd, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        buildingId,
        updatedTx.id,
        updatedTx.date,
        updatedTx.type,
        updatedTx.fund,
        updatedTx.category,
        updatedTx.amountDZD,
        JSON.stringify(updatedTx)
      );
    }

    writeAuditLog(
      buildingId,
      actor,
      'UPDATE_PAYMENT',
      'payment',
      paymentId,
      `Modification cotisation ${updatedPayment.receiptNumber} — ${updatedPayment.apartmentNumber} (${updatedPayment.month})`,
      updatedPayment.amountDZD
    );

    return { payment: updatedPayment, transaction: updatedTx };
  });
}

export function deletePaymentAtomic(buildingId, paymentId, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM payments WHERE building_id = ? AND id = ?').get(buildingId, paymentId);
    if (!row) return false;
    const targetPayment = JSON.parse(row.payload);

    db.prepare('DELETE FROM payments WHERE building_id = ? AND id = ?').run(buildingId, paymentId);

    const txRows = db
      .prepare("SELECT id, payload FROM transactions WHERE building_id = ? AND type = 'recette'")
      .all(buildingId);
    for (const txRow of txRows) {
      const parsedTx = JSON.parse(txRow.payload);
      if (
        txRow.id === `tx-rec-${paymentId}` ||
        Boolean(targetPayment.receiptNumber && parsedTx.referenceDoc === targetPayment.receiptNumber)
      ) {
        db.prepare('DELETE FROM transactions WHERE building_id = ? AND id = ?').run(buildingId, txRow.id);
      }
    }

    writeAuditLog(
      buildingId,
      actor,
      'DELETE_PAYMENT',
      'payment',
      paymentId,
      `Suppression cotisation ${targetPayment.receiptNumber} — ${targetPayment.apartmentNumber} (${targetPayment.month})`,
      targetPayment.amountDZD
    );

    return true;
  });
}

export function addTransaction(buildingId, tx, actor) {
  return runInTransaction(() => {
    const cleanTx = { ...tx, fund: tx.fund || 'courant', amountDZD: Number(tx.amountDZD) };
    db.prepare(
      `INSERT INTO transactions (building_id, id, date, type, fund, category, amount_dzd, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(buildingId, cleanTx.id, cleanTx.date, cleanTx.type, cleanTx.fund, cleanTx.category, cleanTx.amountDZD, JSON.stringify(cleanTx));

    writeAuditLog(
      buildingId,
      actor,
      cleanTx.type === 'recette' ? 'ADD_INCOME' : 'ADD_EXPENSE',
      'transaction',
      cleanTx.id,
      `${cleanTx.category} : ${cleanTx.description}`,
      cleanTx.amountDZD
    );
    return cleanTx;
  });
}

export function deleteTransaction(buildingId, txId, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM transactions WHERE building_id = ? AND id = ?').get(buildingId, txId);
    if (!row) return false;
    const tx = JSON.parse(row.payload);
    db.prepare('DELETE FROM transactions WHERE building_id = ? AND id = ?').run(buildingId, txId);
    writeAuditLog(
      buildingId,
      actor,
      'DELETE_TRANSACTION',
      'transaction',
      txId,
      `Suppression écriture : ${tx.description}`,
      tx.amountDZD
    );
    return true;
  });
}

export function updateBudgetPlan(buildingId, plan, actor) {
  return runInTransaction(() => {
    db.prepare('INSERT OR REPLACE INTO budget_plans (building_id, payload) VALUES (?, ?)').run(
      buildingId,
      JSON.stringify(plan)
    );
    writeAuditLog(buildingId, actor, 'UPDATE_BUDGET', 'budget', buildingId, 'Mise à jour du budget prévisionnel annuel');
    return plan;
  });
}

export function addIncident(buildingId, inc, actor) {
  return runInTransaction(() => {
    db.prepare('INSERT INTO incidents (building_id, id, status, priority, payload) VALUES (?, ?, ?, ?, ?)').run(
      buildingId,
      inc.id,
      inc.status,
      inc.priority,
      JSON.stringify(inc)
    );
    writeAuditLog(buildingId, actor, 'REPORT_INCIDENT', 'incident', inc.id, `Signalement panne : ${inc.title} (${inc.location})`);
    return inc;
  });
}

export function updateIncidentStatusAtomic(buildingId, incId, newStatus, actualCost, resolutionNotes, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM incidents WHERE building_id = ? AND id = ?').get(buildingId, incId);
    if (!row) return null;
    const inc = JSON.parse(row.payload);
    const updated = {
      ...inc,
      status: newStatus,
      actualCostDZD: actualCost !== undefined ? Number(actualCost) : inc.actualCostDZD,
      resolvedDate: newStatus === 'resolu' ? new Date().toISOString() : inc.resolvedDate,
      resolutionNotes: resolutionNotes || inc.resolutionNotes,
    };

    db.prepare('UPDATE incidents SET status = ?, payload = ? WHERE building_id = ? AND id = ?').run(
      updated.status,
      JSON.stringify(updated),
      buildingId,
      incId
    );

    let createdTx = null;
    if (newStatus === 'resolu' && actualCost && Number(actualCost) > 0) {
      createdTx = {
        id: `tx-inc-${incId}-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        type: 'depense',
        fund: 'courant',
        category:
          inc.category === 'ascenseur'
            ? 'Maintenance Ascenseurs'
            : inc.category === 'surpresseur_eau'
            ? 'Réparation Bâche à Eau / Surpresseur'
            : 'Achat Fournitures & Ampoules',
        amountDZD: Number(actualCost),
        description: `Réparation clôturée : ${inc.title}`,
        paymentMethod: 'Espèces',
      };
      db.prepare(
        `INSERT INTO transactions (building_id, id, date, type, fund, category, amount_dzd, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(buildingId, createdTx.id, createdTx.date, createdTx.type, createdTx.fund, createdTx.category, createdTx.amountDZD, JSON.stringify(createdTx));
    }

    writeAuditLog(
      buildingId,
      actor,
      newStatus === 'resolu' ? 'RESOLVE_INCIDENT' : 'UPDATE_INCIDENT',
      'incident',
      incId,
      `Incident "${inc.title}" -> ${newStatus}`,
      actualCost || null
    );

    return { incident: updated, transaction: createdTx };
  });
}

export function addIncidentQuote(buildingId, incId, quote, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM incidents WHERE building_id = ? AND id = ?').get(buildingId, incId);
    if (!row) return null;
    const inc = JSON.parse(row.payload);
    const updated = { ...inc, quotes: [...(inc.quotes || []), quote] };
    db.prepare('UPDATE incidents SET payload = ? WHERE building_id = ? AND id = ?').run(
      JSON.stringify(updated),
      buildingId,
      incId
    );
    writeAuditLog(buildingId, actor, 'ADD_QUOTE', 'incident', incId, `Devis ajouté (${quote.vendorName})`, quote.amountDZD);
    return updated;
  });
}

export function selectIncidentQuote(buildingId, incId, quoteId, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM incidents WHERE building_id = ? AND id = ?').get(buildingId, incId);
    if (!row) return null;
    const inc = JSON.parse(row.payload);
    const quotes = (inc.quotes || []).map((q) => ({ ...q, selected: q.id === quoteId }));
    const picked = quotes.find((q) => q.id === quoteId);
    const updated = {
      ...inc,
      quotes,
      assignedVendor: picked ? picked.vendorName : inc.assignedVendor,
      estimatedCostDZD: picked ? picked.amountDZD : inc.estimatedCostDZD,
    };
    db.prepare('UPDATE incidents SET payload = ? WHERE building_id = ? AND id = ?').run(
      JSON.stringify(updated),
      buildingId,
      incId
    );
    writeAuditLog(
      buildingId,
      actor,
      'SELECT_QUOTE',
      'incident',
      incId,
      `Devis retenu : ${picked?.vendorName || quoteId}`,
      picked?.amountDZD || null
    );
    return updated;
  });
}

export function addPreventiveTask(buildingId, task, actor) {
  return runInTransaction(() => {
    db.prepare('INSERT INTO preventive_tasks (building_id, id, next_due_date, payload) VALUES (?, ?, ?, ?)').run(
      buildingId,
      task.id,
      task.nextDueDate,
      JSON.stringify(task)
    );
    writeAuditLog(buildingId, actor, 'ADD_PREVENTIVE', 'preventive', task.id, `Nouvelle tâche préventive : ${task.title}`);
    return task;
  });
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

export function completePreventiveTaskAtomic(buildingId, taskId, performedDate, performedBy, costDZD, notes, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM preventive_tasks WHERE building_id = ? AND id = ?').get(buildingId, taskId);
    if (!row) return null;
    const task = JSON.parse(row.payload);
    const nextDueDate = computeNextDueDateServer(performedDate, task.frequency);
    const updated = {
      ...task,
      lastDoneDate: performedDate,
      nextDueDate,
      history: [{ date: performedDate, performedBy, costDZD: Number(costDZD) || 0, notes }, ...(task.history || [])],
    };

    db.prepare('UPDATE preventive_tasks SET next_due_date = ?, payload = ? WHERE building_id = ? AND id = ?').run(
      nextDueDate,
      JSON.stringify(updated),
      buildingId,
      taskId
    );

    let createdTx = null;
    if (costDZD && Number(costDZD) > 0) {
      createdTx = {
        id: `tx-prev-${taskId}-${Date.now()}`,
        date: performedDate,
        type: 'depense',
        fund: 'courant',
        category:
          task.equipment === 'ascenseur'
            ? 'Maintenance Ascenseurs'
            : task.equipment === 'surpresseur_eau'
            ? 'Réparation Bâche à Eau / Surpresseur'
            : task.equipment === 'porte_interphone'
            ? 'Serrurerie & Interphone'
            : 'Achat Fournitures & Ampoules',
        amountDZD: Number(costDZD),
        description: `Entretien préventif : ${task.title} (${performedBy})`,
        paymentMethod: 'Espèces',
      };
      db.prepare(
        `INSERT INTO transactions (building_id, id, date, type, fund, category, amount_dzd, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(buildingId, createdTx.id, createdTx.date, createdTx.type, createdTx.fund, createdTx.category, createdTx.amountDZD, JSON.stringify(createdTx));
    }

    writeAuditLog(
      buildingId,
      actor,
      'COMPLETE_PREVENTIVE',
      'preventive',
      taskId,
      `Entretien validé : ${task.title} (${performedBy})`,
      costDZD || null
    );
    return { task: updated, transaction: createdTx };
  });
}

export function addNotice(buildingId, notice, actor) {
  return runInTransaction(() => {
    db.prepare('INSERT INTO notices (building_id, id, date, is_pinned, payload) VALUES (?, ?, ?, ?, ?)').run(
      buildingId,
      notice.id,
      notice.date,
      notice.isPinned ? 1 : 0,
      JSON.stringify(notice)
    );
    writeAuditLog(buildingId, actor, 'ADD_NOTICE', 'notice', notice.id, `Avis publié : ${notice.title}`);
    return notice;
  });
}

export function addVote(buildingId, vote, actor) {
  return runInTransaction(() => {
    db.prepare('INSERT INTO votes (building_id, id, status, payload) VALUES (?, ?, ?, ?)').run(
      buildingId,
      vote.id,
      vote.status,
      JSON.stringify(vote)
    );
    writeAuditLog(buildingId, actor, 'CREATE_VOTE', 'vote', vote.id, `Vote AG ouvert : ${vote.title}`);
    return vote;
  });
}

export function toggleVoteStatus(buildingId, voteId, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM votes WHERE building_id = ? AND id = ?').get(buildingId, voteId);
    if (!row) return null;
    const vote = JSON.parse(row.payload);
    const updated = { ...vote, status: vote.status === 'active' ? 'closed' : 'active' };
    db.prepare('UPDATE votes SET status = ?, payload = ? WHERE building_id = ? AND id = ?').run(
      updated.status,
      JSON.stringify(updated),
      buildingId,
      voteId
    );
    writeAuditLog(buildingId, actor, 'TOGGLE_VOTE', 'vote', voteId, `Vote "${vote.title}" -> ${updated.status}`);
    return updated;
  });
}

export function castVote(buildingId, voteId, optionId, apartmentId, actor) {
  return runInTransaction(() => {
    const row = db.prepare('SELECT payload FROM votes WHERE building_id = ? AND id = ?').get(buildingId, voteId);
    if (!row) return { error: 'Vote introuvable.' };
    const vote = JSON.parse(row.payload);
    if ((vote.votedApartments || []).includes(apartmentId)) {
      return { error: 'Ce logement a déjà exprimé son vote pour cette consultation.' };
    }
    const updated = {
      ...vote,
      votedApartments: [...(vote.votedApartments || []), apartmentId],
      options: (vote.options || []).map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
    };
    db.prepare('UPDATE votes SET payload = ? WHERE building_id = ? AND id = ?').run(
      JSON.stringify(updated),
      buildingId,
      voteId
    );
    writeAuditLog(buildingId, actor, 'CAST_VOTE', 'vote', voteId, `Vote enregistré pour ${apartmentId} (${vote.title})`);
    return { vote: updated };
  });
}

export function addAssemblyMinutes(buildingId, minutes, actor) {
  return runInTransaction(() => {
    db.prepare('INSERT INTO assembly_minutes (building_id, id, date, payload) VALUES (?, ?, ?, ?)').run(
      buildingId,
      minutes.id,
      minutes.date,
      JSON.stringify(minutes)
    );
    writeAuditLog(buildingId, actor, 'ADD_MINUTES', 'minutes', minutes.id, `PV d'AG enregistré : ${minutes.title}`);
    return minutes;
  });
}

export function updateHouseRules(buildingId, rules, actor) {
  return runInTransaction(() => {
    db.prepare('INSERT OR REPLACE INTO house_rules (building_id, payload) VALUES (?, ?)').run(
      buildingId,
      JSON.stringify(rules)
    );
    writeAuditLog(buildingId, actor, 'UPDATE_RULES', 'rules', buildingId, 'Règlement intérieur mis à jour');
    return rules;
  });
}

export function addVendor(buildingId, vendor, actor) {
  return runInTransaction(() => {
    const maxRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS mx FROM vendors WHERE building_id = ?').get(buildingId);
    db.prepare('INSERT INTO vendors (building_id, id, sort_order, payload) VALUES (?, ?, ?, ?)').run(
      buildingId,
      vendor.id,
      (maxRow?.mx || 0) + 1,
      JSON.stringify(vendor)
    );
    writeAuditLog(buildingId, actor, 'ADD_VENDOR', 'vendor', vendor.id, `Prestataire ajouté : ${vendor.name}`);
    return vendor;
  });
}

export function getAuditLogs(buildingId, limit = 150) {
  return db
    .prepare(
      `SELECT id, building_id AS buildingId, timestamp, actor_name AS actorName, actor_role AS actorRole,
              action, entity_type AS entityType, entity_id AS entityId, summary, amount_dzd AS amountDZD
       FROM audit_logs
       WHERE building_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .all(buildingId, Number(limit));
}

// --- Users & Authentication ---

export function authenticateUser(username, password) {
  const cleanUser = String(username || 'president').trim().toLowerCase();
  const row = db
    .prepare('SELECT id, username, full_name, role, salt, password_hash, is_default_password FROM users WHERE LOWER(username) = ?')
    .get(cleanUser);
  if (!row) return null;

  const computed = hashPassword(String(password || ''), row.salt);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(row.password_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    isDefaultPassword: Boolean(row.is_default_password),
  };
}

export function getUserById(userId) {
  const row = db
    .prepare('SELECT id, username, full_name, role, is_default_password FROM users WHERE id = ?')
    .get(userId);
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    isDefaultPassword: Boolean(row.is_default_password),
  };
}

export function listUsers() {
  return db
    .prepare('SELECT id, username, full_name AS fullName, role, created_at AS createdAt FROM users ORDER BY created_at ASC')
    .all();
}

export function createUser({ username, fullName, role, password }, actor, buildingId) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error("L'identifiant doit contenir au moins 3 caractères.");
  }
  if (!['president', 'treasurer', 'technical'].includes(role)) {
    throw new Error('Rôle invalide.');
  }
  if (!password || String(password).length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
  }
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername);
  if (existing) {
    throw new Error('Cet identifiant existe déjà.');
  }

  return runInTransaction(() => {
    const id = `usr-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, username, full_name, role, salt, password_hash, is_default_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(id, cleanUsername, fullName.trim(), role, salt, hashPassword(password, salt), now);
    writeAuditLog(buildingId, actor, 'CREATE_USER', 'user', id, `Création compte ${cleanUsername} (${role})`);
    return { id, username: cleanUsername, fullName: fullName.trim(), role, createdAt: now };
  });
}

export function deleteUser(userId, actor, buildingId) {
  if (userId === actor.id) {
    throw new Error('Impossible de supprimer votre propre compte actif.');
  }
  return runInTransaction(() => {
    const target = db.prepare('SELECT username, role FROM users WHERE id = ?').get(userId);
    if (!target) return false;
    if (target.role === 'president') {
      const presCount = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'president'").get();
      if (presCount && presCount.cnt <= 1) {
        throw new Error('Au moins un compte Président doit rester actif.');
      }
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    writeAuditLog(buildingId, actor, 'DELETE_USER', 'user', userId, `Suppression compte ${target.username}`);
    return true;
  });
}

export function changeUserPassword(userId, currentPassword, newPassword) {
  const row = db.prepare('SELECT id, salt, password_hash FROM users WHERE id = ?').get(userId);
  if (!row) throw new Error('Compte introuvable.');
  const currHash = hashPassword(String(currentPassword || ''), row.salt);
  if (currHash !== row.password_hash) {
    throw new Error('Mot de passe actuel incorrect.');
  }
  if (!newPassword || String(newPassword).trim().length < 6) {
    throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères.');
  }
  const newSalt = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE users SET salt = ?, password_hash = ?, is_default_password = 0 WHERE id = ?').run(
    newSalt,
    hashPassword(String(newPassword).trim(), newSalt),
    userId
  );
  return true;
}
