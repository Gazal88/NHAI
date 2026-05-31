import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import {
  getRecentAttendance,
  getUnsyncedCount,
  getFailureLog,
} from '../services/DatabaseService';

export default function HistoryScreen() {
  const [records, setRecords] = useState([]);
  const [failures, setFailures] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getRecentAttendance(20);
      const failureData = await getFailureLog(5);
      const pending = await getUnsyncedCount();
      setRecords(data);
      setFailures(failureData);
      setPendingCount(pending);
    } catch (e) {
      console.log('History load error:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  const todayCount = records.filter((record) => {
    return new Date(record.timestamp).toDateString() === new Date().toDateString();
  }).length;

  const syncedCount = records.filter((record) => record.synced === 1).length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#5C6B3A"
          colors={['#5C6B3A']}
        />
      }
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5E8" />

      <View style={styles.topBar}>
        <Text style={styles.title}>Attendance Log</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{records.length} records</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVal}>{todayCount}</Text>
          <Text style={styles.summaryLabel}>Today</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryVal, { color: '#C4A35A' }]}>
            {pendingCount}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryVal, { color: '#5C6B3A' }]}>
            {syncedCount}
          </Text>
          <Text style={styles.summaryLabel}>Synced</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Records</Text>

      {records.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>--</Text>
          <Text style={styles.emptyText}>No attendance records yet</Text>
          <Text style={styles.emptySub}>
            Records will appear here after authentication
          </Text>
        </View>
      ) : (
        records.map((item) => (
          <View key={item.id} style={styles.recordCard}>
            <View style={styles.recordAvatar}>
              <Text style={styles.recordAvatarText}>
                {(item.worker_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.recordInfo}>
              <Text style={styles.recordName}>
                {item.worker_name || 'Unknown'}
              </Text>
              <Text style={styles.recordEmpId}>{item.employee_id}</Text>
              <Text style={styles.recordTime}>
                {formatTime(item.timestamp)} | {formatDate(item.timestamp)}
              </Text>
            </View>
            <View style={styles.recordRight}>
              <Text style={styles.recordConfidence}>
                {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : '--'}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: item.synced === 1 ? '#EEF0E8' : '#FFF3CD' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: item.synced === 1 ? '#5C6B3A' : '#C4A35A' },
                  ]}
                >
                  {item.synced === 1 ? 'Synced' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}

      {failures.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Recent Issues</Text>
          {failures.map((item) => (
            <View key={item.id} style={styles.failureCard}>
              <Text style={styles.failureType}>
                {item.type.replace(/_/g, ' ')}
              </Text>
              <Text style={styles.failureTime}>
                {formatTime(item.timestamp)} | {formatDate(item.timestamp)}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F5E8' },
  root: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 20 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#2C3520',
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  countBadge: {
    backgroundColor: '#EEF0E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countText: { color: '#5C6B3A', fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#5C6B3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  summaryVal: {
    color: '#2C3520',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryLabel: { color: '#7A8A6A', fontSize: 11 },
  sectionTitle: {
    color: '#2C3520',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 2,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    elevation: 2,
  },
  emptyIcon: { fontSize: 26, color: '#D4DCC8', marginBottom: 12 },
  emptyText: {
    color: '#2C3520',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: { color: '#A8B5A0', fontSize: 12, textAlign: 'center' },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#5C6B3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  recordAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordAvatarText: {
    color: '#5C6B3A',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  recordInfo: { flex: 1 },
  recordName: {
    color: '#2C3520',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  recordEmpId: {
    color: '#A8B5A0',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 2,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  recordTime: { color: '#7A8A6A', fontSize: 11 },
  recordRight: { alignItems: 'flex-end', gap: 6 },
  recordConfidence: { color: '#5C6B3A', fontSize: 13, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  failureCard: {
    backgroundColor: '#FFF8E8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7D29B',
    marginBottom: 8,
  },
  failureType: {
    color: '#7A5F1D',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
    textTransform: 'capitalize',
  },
  failureTime: { color: '#9A854B', fontSize: 11 },
});
