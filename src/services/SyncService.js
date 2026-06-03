import { createClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedRecords, markSynced, deleteSynced } from './DatabaseService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let syncInProgress = false;
let unsubscribeNetInfo = null;

// ── Sync state listeners ───────────────────────────────────────────────────
// Any screen can subscribe to sync state changes via onSyncStateChange().
// State shape: { syncing: bool, lastSyncedCount: number, lastSyncedAt: number|null, error: string|null }
let syncState = {
  syncing: false,
  lastSyncedCount: 0,
  lastSyncedAt: null,
  error: null,
};
const syncListeners = new Set();

function emitSyncState(patch) {
  syncState = { ...syncState, ...patch };
  syncListeners.forEach((fn) => {
    try { fn(syncState); } catch (_) {}
  });
}

/** Subscribe to sync state updates. Returns an unsubscribe function. */
export function onSyncStateChange(listener) {
  syncListeners.add(listener);
  // Immediately emit current state to new subscriber
  try { listener(syncState); } catch (_) {}
  return () => syncListeners.delete(listener);
}

/** Get current sync state snapshot without subscribing. */
export function getSyncState() {
  return syncState;
}

// ── Supabase insert — explicitly maps only columns that exist in remote table ──
const insertAttendanceRecords = async (records) => {
  // Map to exact Supabase schema — only include columns that exist remotely.
  // This prevents any SQLite-only fields from causing insert failures.
  const remoteRecords = records.map((r) => ({
    id:          r.id,
    worker_id:   r.worker_id,
    employee_id: r.employee_id ?? null,
    worker_name: r.worker_name ?? null,
    timestamp:   r.timestamp,
    gps_lat:     r.gps_lat ?? null,
    gps_lng:     r.gps_lng ?? null,
    confidence:  r.confidence ?? null,
  }));

  console.log('[Sync] Inserting records:', JSON.stringify(remoteRecords[0]));

  const result = await supabase.from('attendance').insert(remoteRecords);

  if (result.error) {
    console.log('[Sync] Supabase error code:', result.error.code);
    console.log('[Sync] Supabase error message:', result.error.message);
    console.log('[Sync] Supabase error details:', result.error.details);
    console.log('[Sync] Supabase error hint:', result.error.hint);
  }

  return result;
};

// ── syncNow ────────────────────────────────────────────────────────────────
export const syncNow = async () => {
  if (syncInProgress) {
    console.log('[Sync] Already in progress, skipping');
    return;
  }
  syncInProgress = true;
  emitSyncState({ syncing: true, error: null });

  try {
    const records = await getUnsyncedRecords();

    if (!records || records.length === 0) {
      console.log('[Sync] No unsynced records found');
      emitSyncState({ syncing: false });
      return;
    }

    console.log(`[Sync] Found ${records.length} unsynced record(s), uploading…`);
    console.log('[Sync] First record id:', records[0]?.id);

    const { error, data } = await insertAttendanceRecords(records);

    if (error) {
      const msg = `${error.message}${error.hint ? ' — ' + error.hint : ''}`;
      console.log('[Sync] Insert failed:', msg);
      emitSyncState({ syncing: false, error: msg });
      return;
    }

    console.log('[Sync] Insert successful, data:', data);

    const ids = records.map((r) => r.id);
    await markSynced(ids);
    await deleteSynced();

    console.log(`[Sync] ✓ Synced ${ids.length} record(s)`);
    emitSyncState({
      syncing: false,
      lastSyncedCount: ids.length,
      lastSyncedAt: Date.now(),
      error: null,
    });
  } catch (err) {
    console.log('[Sync] Unexpected error:', err?.message ?? err);
    emitSyncState({ syncing: false, error: String(err?.message ?? err) });
  } finally {
    syncInProgress = false;
  }
};

// ── startSyncLoop ──────────────────────────────────────────────────────────
/**
 * Attaches a NetInfo listener that fires syncNow() only when the device
 * transitions from offline → online (or on first seen online state).
 * Returns an unsubscribe function.
 */
export const startSyncLoop = () => {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }

  let wasConnected = null;

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const isNowConnected = state.isConnected === true;

    if (isNowConnected && wasConnected !== true) {
      console.log('[Sync] Network online — triggering sync');
      syncNow();
    }

    wasConnected = isNowConnected;
  });

  return unsubscribeNetInfo;
};

export const stopSyncLoop = () => {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
    console.log('[Sync] Listener stopped');
  }
};
