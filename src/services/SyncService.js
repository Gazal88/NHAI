import { createClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedRecords, markSynced, deleteSynced } from './DatabaseService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let syncInProgress = false;

const toLegacyAttendanceRecord = ({ employee_id, ...record }) => record;

const insertAttendanceRecords = async (records) => {
  const result = await supabase
    .from('attendance')
    .insert(records);

  if (
    result.error?.message?.includes("'employee_id' column of 'attendance'")
  ) {
    console.log('Sync fallback: remote attendance table has no employee_id column');
    return supabase
      .from('attendance')
      .insert(records.map(toLegacyAttendanceRecord));
  }

  return result;
};

export const syncWhenOnline = () => {
  return NetInfo.addEventListener(state => {
    if (state.isConnected) {
      syncNow();
    }
  });
};

export const startSyncLoop = syncWhenOnline;

export const syncNow = async () => {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const records = await getUnsyncedRecords();
    if (!records || records.length === 0) return;

    const { error } = await insertAttendanceRecords(records);

    if (error) {
      console.log('Sync failed:', error.message);
      return;
    }

    const ids = records.map(r => r.id);
    await markSynced(ids);
    await deleteSynced();
    console.log(`Synced ${ids.length} records`);
  } catch (err) {
    console.log('Sync error:', err);
  } finally {
    syncInProgress = false;
  }
};
