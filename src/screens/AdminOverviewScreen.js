import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAttendanceSummary, getRecentAttendanceAll } from '../services/DatabaseService';
import { syncNow, onSyncStateChange } from '../services/SyncService';
import { C, FONT, RADIUS, SHADOW } from '../theme';

const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ts) => {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString();
};

export default function AdminOverviewScreen() {
  const [summary, setSummary] = useState({ todayCount: 0, totalCount: 0, pendingSync: 0, activeWorkers: 0 });
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncState, setSyncState] = useState({ syncing: false, lastSyncedAt: null, error: null });
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([getAttendanceSummary(), getRecentAttendanceAll(5)]);
      if (!mounted.current) return;
      setSummary(s); setRecent(r);
    } catch (_) {}
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const unsub = onSyncStateChange((st) => { if (!mounted.current) return; setSyncState(st); load(); });
    return () => { mounted.current = false; unsub(); };
  }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const STATS = [
    { label: "Today's Check-ins", val: summary.todayCount, color: C.primary },
    { label: 'Active Workers', val: summary.activeWorkers, color: C.success },
    { label: 'Pending Sync', val: summary.pendingSync, color: C.warning },
    { label: 'Total Records', val: summary.totalCount, color: C.textPrimary },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Admin Dashboard</Text>
          <Text style={styles.headerTitle}>Overview</Text>
        </View>
        <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>ADMIN</Text></View>
      </View>

      {/* Sync banner */}
      {syncState.syncing && (
        <View style={[styles.banner, styles.bannerActive]}>
          <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.bannerText, { color: C.primary }]}>Syncing to cloud…</Text>
        </View>
      )}
      {!syncState.syncing && summary.pendingSync > 0 && (
        <View style={[styles.banner, styles.bannerPending]}>
          <Text style={[styles.bannerText, { color: C.warningText, flex: 1 }]}>{summary.pendingSync} record{summary.pendingSync === 1 ? '' : 's'} pending sync</Text>
          <TouchableOpacity onPress={syncNow} style={styles.syncBtn}><Text style={styles.syncBtnText}>Sync Now</Text></TouchableOpacity>
        </View>
      )}
      {!syncState.syncing && syncState.lastSyncedAt && summary.pendingSync === 0 && (
        <View style={[styles.banner, styles.bannerDone]}>
          <Text style={[styles.bannerText, { color: C.successText }]}>✓ All records synced</Text>
        </View>
      )}

      {/* Stats grid */}
      <View style={styles.grid}>
        {STATS.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Recent activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {recent.length === 0
        ? <View style={styles.empty}><Text style={styles.emptyText}>No attendance records yet</Text></View>
        : recent.map((r) => (
          <View key={r.id} style={styles.actCard}>
            <View style={styles.actAvatar}>
              <Text style={styles.actAvatarText}>{(r.worker_name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actName}>{r.worker_name || 'Unknown'}</Text>
              <Text style={styles.actMeta}>{r.employee_id}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={styles.actTime}>{fmt(r.timestamp)}</Text>
              <Text style={styles.actDate}>{fmtDate(r.timestamp)}</Text>
              <View style={[styles.pill, r.synced === 1 ? styles.pillDone : styles.pillPend]}>
                <Text style={[styles.pillTxt, r.synced === 1 ? { color: C.successText } : { color: C.warningText }]}>
                  {r.synced === 1 ? '✓ Synced' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        ))
      }
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  root: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  headerSub: { color: C.textSecondary, fontSize: 12, fontWeight: FONT.semiBold, marginBottom: 2 },
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: FONT.extraBold },
  adminBadge: { backgroundColor: C.adminPrimary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm },
  adminBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: FONT.extraBold, letterSpacing: 1.5 },
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 },
  bannerActive: { backgroundColor: C.primaryLight },
  bannerPending: { backgroundColor: C.warningBg },
  bannerDone: { backgroundColor: C.successBg },
  bannerText: { fontSize: 13, fontWeight: FONT.semiBold },
  syncBtn: { backgroundColor: C.primary, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 6 },
  syncBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: FONT.extraBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: '47%', backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 18, ...SHADOW.sm },
  statVal: { fontSize: 30, fontWeight: FONT.black, marginBottom: 4 },
  statLabel: { color: C.textSecondary, fontSize: 12 },
  sectionTitle: { color: C.textPrimary, fontSize: 16, fontWeight: FONT.bold, marginBottom: 12 },
  empty: { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 24, alignItems: 'center' },
  emptyText: { color: C.textMuted, fontSize: 13 },
  actCard: { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, ...SHADOW.sm },
  actAvatar: { width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  actAvatarText: { color: C.primary, fontSize: 17, fontWeight: FONT.extraBold },
  actName: { color: C.textPrimary, fontSize: 14, fontWeight: FONT.bold, marginBottom: 2 },
  actMeta: { color: C.textMuted, fontSize: 11 },
  actTime: { color: C.textPrimary, fontSize: 13, fontWeight: FONT.bold },
  actDate: { color: C.textSecondary, fontSize: 11 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  pillDone: { backgroundColor: C.successBg },
  pillPend: { backgroundColor: C.warningBg },
  pillTxt: { fontSize: 10, fontWeight: FONT.bold },
});
