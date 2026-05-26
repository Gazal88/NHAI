import { createClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedRecords, markSynced, deleteSynced } from './DatabaseService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const syncWhenOnline = () => {
  NetInfo.addEventListener(state => {
    if (state.isConnected) {
      syncNow();
    }
  });
};

export const syncNow = async () => {
  try {
    const records = await getUnsyncedRecords();
    if (!records || records.length === 0) return;

    const { error } = await supabase
      .from('attendance')
      .insert(records);

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
  }
};