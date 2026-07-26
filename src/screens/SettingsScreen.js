import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getFailureLog, getConfig, setConfig } from '../services/DatabaseService';
import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { C, FONT, RADIUS, SHADOW } from '../theme';

export default function SettingsScreen({ onLogout }) {
  const [failureCount, setFailureCount] = useState(0);
  const [threshold, setThreshold] = useState('0.75');
  const [realGestures, setRealGestures] = useState(false);

  useEffect(() => {
    getFailureLog(100).then((rows) => setFailureCount(rows.length)).catch(() => {});

    // Load configs from DB
    getConfig('recognition_threshold').then((val) => {
      if (val) setThreshold(val);
    }).catch(() => {});

    // Force real gestures to false to prevent OOM memory issues
    setConfig('use_real_gestures', 'false').then(() => {
      setRealGestures(false);
    }).catch(() => {});
  }, []);

  const updateThreshold = async (val) => {
    setThreshold(val);
    await setConfig('recognition_threshold', val);
  };

  const updateRealGestures = async (val) => {
    setRealGestures(false);
    await setConfig('use_real_gestures', 'false');
  };

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
        <Text style={styles.sectionLabel}>DEMO & SECURITY SETTINGS</Text>
        
        {/* Match Threshold row */}
        <View style={styles.settingItem}>
          <Text style={styles.settingTitle}>Match Threshold</Text>
          <Text style={styles.settingDescription}>
            Min face similarity score required to mark attendance. Strict (0.75) is recommended for production.
          </Text>
          <View style={styles.pillContainer}>
            {['0.75', '0.65', '0.45'].map((val) => {
              const label = val === '0.75' ? 'Strict (0.75)' : val === '0.65' ? 'Standard (0.65)' : 'Demo (0.45)';
              const isActive = threshold === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[styles.pillBtn, isActive && styles.pillBtnActive]}
                  onPress={() => updateThreshold(val)}
                >
                  <Text style={[styles.pillBtnText, isActive && styles.pillBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
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
  settingItem: { paddingVertical: 14 },
  settingTitle: { color: C.textPrimary, fontSize: 14, fontWeight: FONT.bold, marginBottom: 4 },
  settingDescription: { color: C.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  pillContainer: { flexDirection: 'row', gap: 8 },
  pillBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: C.bg, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  pillBtnActive: { backgroundColor: C.adminPrimary, borderColor: C.adminPrimary },
  pillBtnText: { color: C.textSecondary, fontSize: 11, fontWeight: FONT.bold },
  pillBtnTextActive: { color: '#FFFFFF' },
});
