import {
  StyleSheet, Text, View, ScrollView, StatusBar,
  RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getRecentAttendance, getAttendanceByEmployee, getUnsyncedCount, getFailureLog } from '../services/DatabaseService';
import { syncNow, onSyncStateChange } from '../services/SyncService';
import { C, FONT, RADIUS, SHADOW } from '../theme';

export default function HistoryScreen({ workerFilter = null, showSync = true, showFailures = false }) {
  const [records, setRecords]       = useState([]);
  const [failures, setFailures]     = useState([]);
  const [pendingCount, setPending]  = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [syncState, setSyncState]   = useState({ syncing: false, lastSyncedCount: 0, lastSyncedAt: null, error: null });
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      let data = workerFilter
        ? await getAttendanceByEmployee(workerFilter, 50)
        : await getRecentAttendance(50);

      if (dateFilter === 'today') {
        const s = new Date(); s.setHours(0,0,0,0);
        data = data.filter(r => r.timestamp >= s.getTime());
      } else if (dateFilter === 'week') {
        const s = new Date(); s.setDate(s.getDate()-7); s.setHours(0,0,0,0);
        data = data.filter(r => r.timestamp >= s.getTime());
      }

      const [fails, pend] = await Promise.all([
        showFailures ? getFailureLog(10) : Promise.resolve([]),
        showSync ? getUnsyncedCount() : Promise.resolve(0),
      ]);
      if (!mounted.current) return;
      setRecords(data); setFailures(fails); setPending(pend);
    } catch (_) {}
  }, [workerFilter, dateFilter, showSync, showFailures]);

  useEffect(() => {
    mounted.current = true;
    load();
    const unsub = onSyncStateChange((st) => {
      if (!mounted.current) return;
      setSyncState(st); load();
    });
    return () => { mounted.current = false; unsub(); };
  }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (ts) => {
    const d = new Date(ts); const today = new Date(); const yest = new Date(today);
    yest.setDate(yest.getDate()-1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  const todayCount  = records.filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString()).length;
  const syncedCount = records.filter(r => r.synced === 1).length;

  const renderBanner = () => {
    if (syncState.syncing) return (
      <View style={[styles.banner, styles.bannerActive]}>
        <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.bannerTxt, { color: C.primary }]}>Syncing to cloud…</Text>
      </View>
    );
    if (syncState.error) return (
      <View style={[styles.banner, styles.bannerError]}>
        <Text style={[styles.bannerTxt, { color: C.errorText, flex: 1 }]}>
          Sync failed — {syncState.error.length > 40 ? syncState.error.slice(0,40)+'…' : syncState.error}
        </Text>
        <TouchableOpacity onPress={syncNow} style={styles.retryBtn}><Text style={styles.retryTxt}>Retry</Text></TouchableOpacity>
      </View>
    );
    if (pendingCount > 0) return (
      <View style={[styles.banner, styles.bannerPending]}>
        <Text style={[styles.bannerTxt, { color: C.warningText, flex: 1 }]}>{pendingCount} record{pendingCount===1?'':'s'} pending sync</Text>
        <TouchableOpacity onPress={syncNow} style={styles.syncNowBtn}><Text style={styles.syncNowTxt}>Sync Now</Text></TouchableOpacity>
      </View>
    );
    if (syncState.lastSyncedAt) return (
      <View style={[styles.banner, styles.bannerDone]}>
        <Text style={[styles.bannerTxt, { color: C.successText }]}>✓ All synced · {syncState.lastSyncedCount} records</Text>
      </View>
    );
    return null;
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.topBar}>
        <Text style={styles.title}>{workerFilter ? 'My Attendance' : 'Attendance Log'}</Text>
        <View style={styles.countBadge}><Text style={styles.countTxt}>{records.length} records</Text></View>
      </View>

      {/* Date filter — admin only */}
      {!workerFilter && (
        <View style={styles.filterRow}>
          {['today','week','all'].map((f) => (
            <TouchableOpacity key={f} style={[styles.filterBtn, dateFilter===f && styles.filterBtnActive]} onPress={() => setDateFilter(f)}>
              <Text style={[styles.filterTxt, dateFilter===f && styles.filterTxtActive]}>
                {f==='today' ? 'Today' : f==='week' ? 'This Week' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sync banner */}
      {showSync && renderBanner()}

      {/* Summary */}
      <View style={styles.summaryRow}>
        {[
          { val: todayCount, label: 'Today', color: C.primary },
          { val: pendingCount, label: 'Pending', color: C.warning },
          { val: syncedCount, label: 'Synced', color: C.success },
        ].map((s) => (
          <View key={s.label} style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: s.color }]}>{s.val}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Records</Text>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptySub}>{workerFilter ? 'Your attendance will appear here.' : 'Records will appear here after check-ins.'}</Text>
        </View>
      ) : (
        records.map((item) => (
          <View key={item.id} style={styles.recordCard}>
            <View style={styles.recAvatar}>
              <Text style={styles.recAvatarTxt}>{(item.worker_name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.recInfo}>
              <Text style={styles.recName}>{item.worker_name || 'Unknown'}</Text>
              <Text style={styles.recId}>{item.employee_id}</Text>
              <Text style={styles.recTime}>{fmt(item.timestamp)} · {fmtDate(item.timestamp)}</Text>
            </View>
            <View style={styles.recRight}>
              <View style={[styles.pill, item.synced===1 ? styles.pillDone : styles.pillPend]}>
                <Text style={[styles.pillTxt, item.synced===1 ? { color: C.successText } : { color: C.warningText }]}>
                  {item.synced===1 ? '✓ Synced' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}

      {showFailures && failures.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Recent Issues</Text>
          {failures.map((item) => (
            <View key={item.id} style={styles.failCard}>
              <Text style={styles.failType}>{item.type.replace(/_/g,' ')}</Text>
              <Text style={styles.failTime}>{fmt(item.timestamp)} · {fmtDate(item.timestamp)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  root: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: C.textPrimary, fontSize: 26, fontWeight: FONT.extraBold },
  countBadge: { backgroundColor: C.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  countTxt: { color: C.primary, fontSize: 12, fontWeight: FONT.bold },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  filterBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterTxt: { color: C.textSecondary, fontSize: 12, fontWeight: FONT.semiBold },
  filterTxtActive: { color: '#FFFFFF' },
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  bannerActive: { backgroundColor: C.primaryLight },
  bannerPending: { backgroundColor: C.warningBg },
  bannerDone: { backgroundColor: C.successBg },
  bannerError: { backgroundColor: C.errorBg },
  bannerTxt: { fontSize: 13, fontWeight: FONT.semiBold },
  syncNowBtn: { backgroundColor: C.primary, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 6 },
  syncNowTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: FONT.extraBold },
  retryBtn: { borderWidth: 1, borderColor: C.error, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 6 },
  retryTxt: { color: C.error, fontSize: 12, fontWeight: FONT.bold },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', ...SHADOW.sm },
  summaryVal: { fontSize: 24, fontWeight: FONT.extraBold, marginBottom: 2 },
  summaryLabel: { color: C.textSecondary, fontSize: 11 },
  sectionTitle: { color: C.textPrimary, fontSize: 15, fontWeight: FONT.bold, marginBottom: 10 },
  empty: { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 36, alignItems: 'center', ...SHADOW.sm },
  emptyTitle: { color: C.textPrimary, fontSize: 15, fontWeight: FONT.bold, marginBottom: 6 },
  emptySub: { color: C.textSecondary, fontSize: 12, textAlign: 'center' },
  recordCard: { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, ...SHADOW.sm },
  recAvatar: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  recAvatarTxt: { color: C.primary, fontSize: 18, fontWeight: FONT.extraBold },
  recInfo: { flex: 1 },
  recName: { color: C.textPrimary, fontSize: 14, fontWeight: FONT.bold, marginBottom: 2 },
  recId: { color: C.textMuted, fontSize: 10, letterSpacing: 0.8, marginBottom: 2 },
  recTime: { color: C.textSecondary, fontSize: 11 },
  recRight: { alignItems: 'flex-end' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  pillDone: { backgroundColor: C.successBg },
  pillPend: { backgroundColor: C.warningBg },
  pillTxt: { fontSize: 10, fontWeight: FONT.bold },
  failCard: { backgroundColor: C.errorBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: C.error+'33', marginBottom: 8 },
  failType: { color: C.errorText, fontSize: 12, fontWeight: FONT.extraBold, marginBottom: 3, textTransform: 'capitalize' },
  failTime: { color: C.error, fontSize: 11 },
});
