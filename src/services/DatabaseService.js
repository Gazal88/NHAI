/**
 * DatabaseService.js
 *
 * Single module-level `db` variable — initialised ONCE by initDB().
 * All other exported functions use that same variable.
 * App.js calls initDB() on boot and only renders screens after it resolves,
 * so no function here can be called before db is ready.
 */
import * as SQLite from 'expo-sqlite';

let db = null; // module singleton

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeIdentityName(name = '') {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseEmbedding(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return null;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = Number(a[i]);
    const bv = Number(b[i]);
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getColumnNames(tableName) {
  const rows = await db.getAllAsync(`PRAGMA table_info(${tableName})`);
  return new Set(rows.map((row) => row.name));
}

async function addMissingColumns(tableName, columns) {
  const existingColumns = await getColumnNames(tableName);

  for (const [columnName, definition] of columns) {
    if (!existingColumns.has(columnName)) {
      await db.execAsync(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`
      );
    }
  }
}

async function migrateExistingSchema() {
  await addMissingColumns('workers', [
    ['employee_id', 'TEXT'],
    ['department', 'TEXT'],
    ['passcode', 'TEXT'],
    ['embedding', 'TEXT'],
    ['enrolled_at', 'INTEGER'],
  ]);

  await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workers_employee_id
    ON workers(employee_id)
    WHERE employee_id IS NOT NULL;
  `);

  await addMissingColumns('attendance', [
    ['employee_id', 'TEXT'],
    ['worker_name', 'TEXT'],
    ['gps_lat', 'REAL'],
    ['gps_lng', 'REAL'],
    ['confidence', 'REAL'],
    ['synced', 'INTEGER DEFAULT 0'],
  ]);

  await db.runAsync('UPDATE attendance SET synced = 0 WHERE synced IS NULL');
}

function requireDB() {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDB() before using DatabaseService.');
  }
  return db;
}

async function findWorkerByEmployeeId(employeeId) {
  return db.getFirstAsync(
    'SELECT * FROM workers WHERE employee_id = ?',
    [employeeId]
  );
}

// ─── initDB ────────────────────────────────────────────────────────────────
export async function initDB() {
  if (db) return; // already initialised — idempotent

  db = await SQLite.openDatabaseAsync('faceauth.db');

  // Enable WAL mode for performance
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // ── Create tables ──────────────────────────────────────────────────────────
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS workers (
      id           TEXT PRIMARY KEY,
      employee_id  TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      department   TEXT,
      passcode     TEXT,
      embedding    TEXT,
      enrolled_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id          TEXT PRIMARY KEY,
      worker_id   TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      worker_name TEXT,
      timestamp   INTEGER NOT NULL,
      gps_lat     REAL,
      gps_lng     REAL,
      confidence  REAL,
      synced      INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS failure_log (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      timestamp   INTEGER NOT NULL,
      details     TEXT
    );
  `);

  await migrateExistingSchema();

  // ── Seed EMP001 (idempotent via INSERT OR IGNORE) ─────────────────────────
  const seededWorker = await getWorkerByEmployeeId('EMP001');

  if (!seededWorker) {
    await db.runAsync(
      `INSERT OR REPLACE INTO workers
         (id, employee_id, name, department, passcode, enrolled_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'seed-worker-001',
        'EMP001',
        'Rajesh Kumar',
        'Engineering',
        '1234',
        Date.now(),
      ]
    );
  } else if (!seededWorker.passcode) {
    await db.runAsync(
      'UPDATE workers SET passcode = ? WHERE employee_id = ?',
      ['1234', 'EMP001']
    );
  }

  console.log('[DB] initDB complete');
}

// ─── getWorkerByEmployeeId ─────────────────────────────────────────────────
export async function getWorkerByEmployeeId(employeeId) {
  requireDB();
  const row = await findWorkerByEmployeeId(employeeId.trim().toUpperCase());
  return row ?? null;
}

// ─── getAllWorkers ─────────────────────────────────────────────────────────
export async function getAllWorkers() {
  requireDB();
  return db.getAllAsync('SELECT * FROM workers ORDER BY name ASC');
}

export async function findPotentialDuplicateWorker({
  employeeId,
  name,
  embedding,
  threshold = 0.82,
}) {
  requireDB();
  const targetEmployeeId = employeeId.trim().toUpperCase();
  const targetName = normalizeIdentityName(name);
  const targetEmbedding = parseEmbedding(embedding);
  const workers = await getAllWorkers();

  for (const worker of workers) {
    if (worker.employee_id === targetEmployeeId) continue;

    if (targetName && normalizeIdentityName(worker.name) === targetName) {
      return {
        reason: 'NAME_MATCH',
        worker,
        score: null,
      };
    }

    const existingEmbedding = parseEmbedding(worker.embedding);
    if (targetEmbedding && existingEmbedding) {
      const score = cosineSimilarity(targetEmbedding, existingEmbedding);
      if (score !== null && score >= threshold) {
        return {
          reason: 'FACE_MATCH',
          worker,
          score,
        };
      }
    }
  }

  return null;
}

// ─── saveWorker ───────────────────────────────────────────────────────────
export async function saveWorker({ employeeId, name, department, passcode, embedding }) {
  requireDB();
  const id = makeId('worker');
  await db.runAsync(
    `INSERT OR REPLACE INTO workers
       (id, employee_id, name, department, passcode, embedding, enrolled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      employeeId,
      name,
      department ?? null,
      passcode ?? null,
      embedding ?? null,
      Date.now(),
    ]
  );
  return id;
}

export async function enrollWorker(employeeId, name, department, passcode, embedding) {
  const duplicate = await findPotentialDuplicateWorker({
    employeeId,
    name,
    embedding,
  });

  if (duplicate) {
    const error = new Error(
      duplicate.reason === 'FACE_MATCH'
        ? 'DUPLICATE_FACE'
        : 'DUPLICATE_WORKER_NAME'
    );
    error.code = duplicate.reason;
    error.duplicate = duplicate;
    throw error;
  }

  return saveWorker({
    employeeId: employeeId.trim().toUpperCase(),
    name: name.trim(),
    department: department?.trim() || null,
    passcode: passcode?.trim() || null,
    embedding: embedding ? JSON.stringify(embedding) : null,
  });
}

// ─── logAttendance ────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string} params.workerId
 * @param {string} params.employeeId
 * @param {string} params.workerName
 * @param {number|null} params.gpsLat
 * @param {number|null} params.gpsLng
 * @param {number} params.confidence   0.0 – 1.0
 */
export async function logAttendance({
  workerId,
  employeeId,
  workerName,
  gpsLat = null,
  gpsLng = null,
  confidence = 1.0,
}) {
  requireDB();
  const id = makeId('attendance');
  await db.runAsync(
    `INSERT INTO attendance
       (id, worker_id, employee_id, worker_name, timestamp,
        gps_lat, gps_lng, confidence, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, workerId, employeeId, workerName, Date.now(),
     gpsLat, gpsLng, confidence]
  );
  return id;
}

// ─── getAttendanceHistory ──────────────────────────────────────────────────
export async function getAttendanceHistory(limit = 50) {
  requireDB();
  return db.getAllAsync(
    `SELECT * FROM attendance ORDER BY timestamp DESC LIMIT ?`,
    [limit]
  );
}

export async function getRecentAttendance(limit = 50) {
  return getAttendanceHistory(limit);
}

// ─── getPendingCount ──────────────────────────────────────────────────────
export async function getPendingCount() {
  requireDB();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM attendance WHERE synced = 0'
  );
  return row?.count ?? 0;
}

export async function getUnsyncedCount() {
  return getPendingCount();
}

// ─── markSynced ───────────────────────────────────────────────────────────
export async function markSynced(ids) {
  requireDB();
  if (!ids?.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE attendance SET synced = 1 WHERE id IN (${placeholders})`,
    ids
  );
}

// ─── getUnsyncedAttendance ────────────────────────────────────────────────
export async function getUnsyncedAttendance() {
  requireDB();
  return db.getAllAsync(
    'SELECT * FROM attendance WHERE synced = 0 ORDER BY timestamp ASC'
  );
}

export async function getUnsyncedRecords() {
  return getUnsyncedAttendance();
}

export async function deleteSynced() {
  requireDB();
  await db.runAsync('DELETE FROM attendance WHERE synced = 1');
}

export async function getAttendanceCount() {
  return getPendingCount();
}

export async function logFailure(type, details = {}) {
  requireDB();
  const id = makeId('failure');
  await db.runAsync(
    `INSERT INTO failure_log (id, type, timestamp, details)
     VALUES (?, ?, ?, ?)`,
    [id, type, Date.now(), JSON.stringify(details)]
  );
  return id;
}

export async function getFailureLog(limit = 50) {
  requireDB();
  return db.getAllAsync(
    'SELECT * FROM failure_log ORDER BY timestamp DESC LIMIT ?',
    [limit]
  );
}

// ─── app_config helpers ───────────────────────────────────────────────────
export async function setConfig(key, value) {
  requireDB();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)',
    [key, String(value)]
  );
}

export async function deleteConfig(key) {
  requireDB();
  await db.runAsync('DELETE FROM app_config WHERE key = ?', [key]);
}

export async function getConfig(key) {
  requireDB();
  const row = await db.getFirstAsync(
    'SELECT value FROM app_config WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}
