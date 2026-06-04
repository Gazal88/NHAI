import { createClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedRecords, markSynced, deleteSynced } from './DatabaseService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) => fetch(url, options),
  },
});

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

const insertAttendanceRecords = async (records) => {
  const remoteRecords = records.map(({ synced, ...rest }) => rest);
  return supabase.from('attendance').insert(remoteRecords);
};

export const syncNow = async () => {
  if (syncInProgress) return;
  syncInProgress = true;
  emitSyncState({ syncing: true, error: null });

  try {
    const records = await getUnsyncedRecords();
    if (!records || records.length === 0) { emitSyncState({ syncing: false }); return; }

    console.log(`[Sync] Uploading ${records.length} record(s)…`);
    const { error, data } = await insertAttendanceRecords(records);

    if (error) {
      console.log('[Sync] Failed:', error.message, error.code, error.hint);
      emitSyncState({ syncing: false, error: `${error.message}${error.hint ? ' — ' + error.hint : ''}` });
      return;
    }

    const ids = records.map((r) => r.id);
    await markSynced(ids);
    await deleteSynced();
    console.log(`[Sync] ✓ Synced ${ids.length} record(s)`);
    emitSyncState({ syncing: false, lastSyncedCount: ids.length, lastSyncedAt: Date.now(), error: null });
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
    if (isNowConnected && wasConnected !== true) { console.log('[Sync] Network online — triggering sync'); syncNow(); }
    wasConnected = isNowConnected;
  });
  return unsubscribeNetInfo;
};

export const stopSyncLoop = () => {
  if (unsubscribeNetInfo) { unsubscribeNetInfo(); unsubscribeNetInfo = null; }
};
