import * as SQLite from 'expo-sqlite';

let db;

export const initDB = async () => {
  db = await SQLite.openDatabaseAsync('faceauth.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      embedding TEXT,
      enrolled_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      worker_name TEXT,
      timestamp INTEGER NOT NULL,
      gps_lat REAL,
      gps_lng REAL,
      confidence REAL,
      synced INTEGER DEFAULT 0
    );
  `);
};

export const enrollWorker = async (name, embedding = null) => {
  const id = Date.now().toString();
  await db.runAsync(
    'INSERT INTO workers (id, name, embedding, enrolled_at) VALUES (?, ?, ?, ?)',
    [id, name, embedding ? JSON.stringify(embedding) : null, Date.now()]
  );
  return id;
};

export const getAllWorkers = async () => {
  return await db.getAllAsync('SELECT * FROM workers');
};

export const logAttendance = async (workerId, workerName, confidence = 0, lat = 0, lng = 0) => {
  const id = Date.now().toString();
  await db.runAsync(
    'INSERT INTO attendance (id, worker_id, worker_name, timestamp, gps_lat, gps_lng, confidence, synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
    [id, workerId, workerName, Date.now(), lat, lng, confidence]
  );
  return id;
};

export const getUnsyncedRecords = async () => {
  return await db.getAllAsync('SELECT * FROM attendance WHERE synced = 0');
};

export const markSynced = async (ids) => {
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE attendance SET synced = 1 WHERE id IN (${placeholders})`,
    ids
  );
};

export const deleteSynced = async () => {
  await db.runAsync('DELETE FROM attendance WHERE synced = 1');
};

export const getAttendanceCount = async () => {
  const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM attendance WHERE synced = 0');
  return result.count;
};
