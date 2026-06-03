import {
  Alert, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { deactivateWorker, getAllWorkers } from '../services/DatabaseService';
import { C, FONT, RADIUS, SHADOW } from '../theme';

export default function WorkersScreen({ onEnrollNew }) {
  const [workers, setWorkers]   = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId]     = useState(null);

  const load = useCallback(async () => {
    const rows = await getAllWorkers();
    setWorkers(rows);
    setFiltered(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    setFiltered(!q ? workers : workers.filter(w =>
      w.name.toLowerCase().includes(q) || w.employee_id.toLowerCase().includes(q)
    ));
  }, [search, workers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const confirmDeactivate = (worker) => {
    Alert.alert(
      'Remove Worker?',
      `${worker.name} (${worker.employee_id}) will no longer be able to log in. Past records are preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          setBusyId(worker.employee_id);
          try { await deactivateWorker(worker.employee_id); await load(); }
          catch (_) { Alert.alert('Remove Failed', 'Please try again.'); }
          finally { setBusyId(null); }
        }},
      ]
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Admin</Text>
          <Text style={styles.headerTitle}>Workers</Text>
        </View>
        <TouchableOpacity style={styles.enrollBtn} onPress={onEnrollNew} activeOpacity={0.85}>
          <Text style={styles.enrollBtnText}>+ Enroll</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID…"
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <Text style={styles.count}>{filtered.length} of {workers.length} worker{workers.length === 1 ? '' : 's'}</Text>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{workers.length === 0 ? 'No workers enrolled' : 'No results'}</Text>
          <Text style={styles.emptyText}>{workers.length === 0 ? 'Tap "+ Enroll" to add the first worker.' : 'Try a different search.'}</Text>
        </View>
      ) : (
        filtered.map((w) => (
          <View key={w.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(w.name || 'W').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.wName}>{w.name}</Text>
              <Text style={styles.wId}>{w.employee_id}</Text>
              {w.department ? <Text style={styles.wDept}>{w.department}</Text> : null}
              <View style={[styles.templatePill, w.embedding ? styles.pillDone : styles.pillMissing]}>
                <Text style={[styles.templateText, w.embedding ? styles.templateDone : styles.templateMissing]}>
                  {w.embedding ? 'Face enrolled' : 'No face template'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.removeBtn, busyId === w.employee_id && styles.removeBtnDisabled]}
              disabled={busyId === w.employee_id}
              onPress={() => confirmDeactivate(w)}
            >
              <Text style={styles.removeBtnText}>{busyId === w.employee_id ? '…' : 'Remove'}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  root: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  headerSub: { color: C.textSecondary, fontSize: 12, fontWeight: FONT.semiBold, marginBottom: 2 },
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: FONT.extraBold },
  enrollBtn: { backgroundColor: C.primary, borderRadius: RADIUS.md, paddingHorizontal: 18, paddingVertical: 11, ...SHADOW.md },
  enrollBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: FONT.extraBold },
  searchWrap: { marginBottom: 10 },
  searchInput: { backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.textPrimary, fontWeight: FONT.medium },
  count: { color: C.textSecondary, fontSize: 12, marginBottom: 12 },
  empty: { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  emptyTitle: { color: C.textPrimary, fontSize: 15, fontWeight: FONT.bold, marginBottom: 4 },
  emptyText: { color: C.textSecondary, fontSize: 13, textAlign: 'center' },
  card: { backgroundColor: C.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.primary, fontSize: 19, fontWeight: FONT.black },
  info: { flex: 1 },
  wName: { color: C.textPrimary, fontSize: 15, fontWeight: FONT.extraBold, marginBottom: 2 },
  wId: { color: C.primary, fontSize: 12, fontWeight: FONT.bold, marginBottom: 2 },
  wDept: { color: C.textSecondary, fontSize: 12, marginBottom: 4 },
  templatePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  pillDone: { backgroundColor: C.successBg },
  pillMissing: { backgroundColor: C.warningBg },
  templateText: { fontSize: 11, fontWeight: FONT.bold },
  templateDone: { color: C.successText },
  templateMissing: { color: C.warningText },
  removeBtn: { borderWidth: 1.5, borderColor: C.error, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 8 },
  removeBtnDisabled: { opacity: 0.4 },
  removeBtnText: { color: C.error, fontSize: 12, fontWeight: FONT.extraBold },
});
