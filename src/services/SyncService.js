/**
 * SyncService — uses plain fetch() instead of @supabase/supabase-js
 * to avoid Node.js built-in dependencies (ws, stream) that break
 * iOS Hermes builds.
 */
import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedRecords, markSynced, deleteSynced } from './DatabaseService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

const ATTENDANCE_URL = `${SUPABASE_URL}/rest/v1/attendance`;

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Prefer': 'return=minimal',
};

let syncInProgress = false;
let unsubscribeNetInfo = null;

let syncState = {
  syncing: false,
  lastSyncedCount: 0,
  lastSyncedAt: null,
  error: null,
};
const syncListeners = new Set();

function emitSyncState(patch) {
  syncState = { ...syncState, ...patch };
  syncListeners.forEach((fn) => { try { fn(syncState); } catch (_) {} });
}

export function onSyncStateChange(listener) {
  syncListeners.add(listener);
  try { listener(syncState); } catch (_) {}
  return () => syncListeners.delete(listener);
}

export function getSyncState() { return syncState; }

const insertRecords = async (records) => {
  const body = records.map(({ synced, ...rest }) => rest);
  const res = await fetch(ATTENDANCE_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res;
};

export const syncNow = async () => {
  if (syncInProgress) return;
  syncInProgress = true;
  emitSyncState({ syncing: true, error: null });

  try {
    const records = await getUnsyncedRecords();
    if (!records || records.length === 0) {
      emitSyncState({ syncing: false });
      return;
    }

    console.log(`[Sync] Uploading ${records.length} record(s)…`);
    await insertRecords(records);

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
    console.log('[Sync] Error:', err?.message ?? err);
    emitSyncState({ syncing: false, error: String(err?.message ?? err) });
  } finally {
    syncInProgress = false;
  }
};

export const startSyncLoop = () => {
  if (unsubscribeNetInfo) { unsubscribeNetInfo(); unsubscribeNetInfo = null; }
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
  if (unsubscribeNetInfo) { unsubscribeNetInfo(); unsubscribeNetInfo = null; }
};
