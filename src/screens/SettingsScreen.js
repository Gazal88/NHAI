import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getFailureLog } from '../services/DatabaseService';
import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { C, FONT, RADIUS, SHADOW } from '../theme';

export default function SettingsScreen({ onLogout }) {
  const [failureCount, setFailureCount] = useState(0);

  useEffect(() => {
    getFailureLog(100).then((rows) => setFailureCount(rows.length)).catch(() => {});
  }, []);

  const confirmLogout = () => Alert.alert(
    'Logout Admin',
    'This will end the admin session and return to the login screen.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: onLogout }]
  );

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root}>
      <Text style={styles.pageTitle}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>CURRENT SESSION</Text>
        <Text style={styles.sessionName}>Administrator</Text>
        <Text style={styles.sessionMeta}>Full access — enroll, manage, view all records</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>APPLICATION</Text>
        {[
          { k: 'App Name', v: 'Pehchaan' },
          { k: 'Version', v: appVersion },
          { k: 'Platform', v: 'Offline-first · Supabase sync' },
        ].map((item, i, arr) => (
          <View key={item.k}>
            <View style={styles.row}>
              <Text style={styles.rowKey}>{item.k}</Text>
              <Text style={styles.rowVal}>{item.v}</Text>
            </View>
            {i < arr.length - 1 && <View style={styles.div} />}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DIAGNOSTICS</Text>
        <View style={styles.row}>
          <Text style={styles.rowKey}>Failure log entries</Text>
          <Text style={[styles.rowVal, failureCount > 0 ? styles.valWarn : styles.valOk]}>
            {failureCount}
          </Text>
        </View>
        {failureCount > 0 && (
          <>
            <View style={styles.div} />
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => Alert.alert(
                'Clear Failure Log?',
                'This will delete all recorded failures. Cannot be undone.',
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => setFailureCount(0) }]
              )}
            >
              <Text style={styles.clearBtnText}>Clear failure log</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Logout Admin</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  root: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 32 },
  pageTitle: { color: C.textPrimary, fontSize: 26, fontWeight: FONT.extraBold, marginBottom: 20 },
  card: { backgroundColor: C.surface, borderRadius: RADIUS.lg, paddingHorizontal: 16, marginBottom: 14, ...SHADOW.sm },
  sectionLabel: { color: C.textMuted, fontSize: 11, fontWeight: FONT.bold, letterSpacing: 1, paddingTop: 14, marginBottom: 10 },
  sessionName: { color: C.textPrimary, fontSize: 18, fontWeight: FONT.extraBold, marginBottom: 4 },
  sessionMeta: { color: C.textSecondary, fontSize: 13, lineHeight: 18, paddingBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  div: { height: 1, backgroundColor: C.divider },
  rowKey: { color: C.textSecondary, fontSize: 13 },
  rowVal: { color: C.textPrimary, fontSize: 13, fontWeight: FONT.bold },
  valWarn: { color: C.warning },
  valOk: { color: C.success },
  clearBtn: { paddingVertical: 12, alignItems: 'center' },
  clearBtnText: { color: C.error, fontSize: 13, fontWeight: FONT.bold },
  logoutBtn: { backgroundColor: C.error, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...SHADOW.md },
  logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: FONT.extraBold },
});
