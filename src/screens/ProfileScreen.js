import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Image, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getTodayAttendanceByEmployee, updateWorkerProfile } from '../services/DatabaseService';
import { C, FONT, RADIUS, SHADOW } from '../theme';

let avatarPlaceholder = null;
try { avatarPlaceholder = require('../../assets/images/avatar_placeholder.png'); } catch (_) {}

const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
const fmtDate = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString();
};
const getInitials = (name = '') => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length === 0 ? '--' : p.slice(0, 2).map(x => x[0]).join('').toUpperCase();
};

export default function ProfileScreen({ worker, onLogout, onWorkerUpdated }) {
  const [todayRecord, setTodayRecord] = useState(null);
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [photoUri, setPhotoUri]       = useState(worker?.photo_uri ?? null);
  const [email, setEmail]             = useState(worker?.email ?? '');
  const [phone, setPhone]             = useState(worker?.phone ?? '');

  const loadToday = useCallback(async () => {
    if (!worker?.employee_id) return;
    try { setTodayRecord((await getTodayAttendanceByEmployee(worker.employee_id)) ?? null); }
    catch (_) {}
  }, [worker?.employee_id]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Sync local state if worker prop updates (e.g. after save)
  useEffect(() => {
    setPhotoUri(worker?.photo_uri ?? null);
    setEmail(worker?.email ?? '');
    setPhone(worker?.phone ?? '');
  }, [worker]);

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to change your profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWorkerProfile(worker.employee_id, {
        email: email.trim() || null,
        phone: phone.trim() || null,
        photoUri: photoUri || null,
      });
      setEditing(false);
      onWorkerUpdated?.(); // tell App.js to refresh worker from DB
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => Alert.alert(
    'Logout', 'This will clear your saved session on this device.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: onLogout }]
  );

  const ini = getInitials(worker?.name ?? '');
  const hasPhoto = !!photoUri;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>My Profile</Text>
        <TouchableOpacity
          style={[styles.editBtn, editing && styles.editBtnActive]}
          onPress={() => { if (editing) { setEditing(false); } else { setEditing(true); } }}
        >
          <Text style={[styles.editBtnText, editing && styles.editBtnTextActive]}>
            {editing ? 'Cancel' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Avatar card */}
      <View style={styles.avatarCard}>
        <TouchableOpacity
          onPress={editing ? pickPhoto : undefined}
          activeOpacity={editing ? 0.7 : 1}
          style={styles.avatarWrap}
        >
          {hasPhoto ? (
            <Image source={{ uri: photoUri }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatarCircle}>
              {avatarPlaceholder ? (
                <Image source={avatarPlaceholder} style={styles.avatarImg} resizeMode="contain" />
              ) : (
                <Text style={styles.avatarText}>{ini}</Text>
              )}
            </View>
          )}
          {editing && (
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>Change</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.workerName}>{worker?.name ?? '—'}</Text>
        <Text style={styles.workerEmpId}>{worker?.employee_id ?? ''}</Text>
        {worker?.department ? <Text style={styles.workerDept}>{worker.department}</Text> : null}
      </View>

      {/* Today attendance status */}
      <View style={[styles.statusCard, todayRecord ? styles.statusDone : styles.statusPending]}>
        <Text style={todayRecord ? styles.statusIconDone : styles.statusIconPending}>
          {todayRecord ? '✓' : '○'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={todayRecord ? styles.statusTitleDone : styles.statusTitlePending}>
            {todayRecord ? 'Attendance marked' : 'Not yet marked today'}
          </Text>
          <Text style={styles.statusSub}>
            {todayRecord
              ? `${fmt(todayRecord.timestamp)} · ${fmtDate(todayRecord.timestamp)}`
              : 'Go to Verify tab to mark attendance'}
          </Text>
        </View>
      </View>

      {/* Contact details */}
      <View style={styles.detailCard}>
        <Text style={styles.sectionLabel}>CONTACT DETAILS</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>EMAIL</Text>
          {editing ? (
            <TextInput
              style={styles.detailInput}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={C.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : (
            <Text style={[styles.detailValue, !email && styles.detailEmpty]}>
              {email || 'Not set'}
            </Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>PHONE</Text>
          {editing ? (
            <TextInput
              style={styles.detailInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 00000 00000"
              placeholderTextColor={C.textMuted}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={[styles.detailValue, !phone && styles.detailEmpty]}>
              {phone || 'Not set'}
            </Text>
          )}
        </View>
      </View>

      {/* Work details */}
      <View style={styles.detailCard}>
        <Text style={styles.sectionLabel}>WORK DETAILS</Text>
        {[
          { label: 'EMPLOYEE ID', value: worker?.employee_id ?? '—' },
          { label: 'DEPARTMENT',  value: worker?.department  ?? 'Not set' },
          {
            label: 'FACE TEMPLATE',
            value: worker?.embedding ? 'Enrolled ✓' : 'Not enrolled',
            color: worker?.embedding ? C.success : C.warning,
          },
        ].map((row, i, arr) => (
          <View key={row.label}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={[styles.detailValue, row.color ? { color: row.color } : null]}>
                {row.value}
              </Text>
            </View>
            {i < arr.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      {!worker?.embedding && (
        <View style={styles.warnCard}>
          <Text style={styles.warnTitle}>Face not enrolled</Text>
          <Text style={styles.warnText}>Contact your admin to enrol your face before marking attendance.</Text>
        </View>
      )}

      {/* Save button when editing */}
      {editing && (
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  root: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 32 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { color: C.textPrimary, fontSize: 26, fontWeight: FONT.extraBold },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: C.primary },
  editBtnActive: { backgroundColor: C.errorBg, borderColor: C.error },
  editBtnText: { color: C.primary, fontSize: 13, fontWeight: FONT.bold },
  editBtnTextActive: { color: C.error },

  avatarCard: { backgroundColor: C.surface, borderRadius: RADIUS.xl, padding: 24, alignItems: 'center', marginBottom: 14, ...SHADOW.md },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: C.primary },
  avatarImg: { width: 52, height: 52, tintColor: '#FFFFFF' },
  avatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: FONT.black },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: C.surface,
  },
  avatarEditBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: FONT.bold },

  workerName: { color: C.textPrimary, fontSize: 20, fontWeight: FONT.extraBold, marginBottom: 4 },
  workerEmpId: { color: C.primary, fontSize: 13, fontWeight: FONT.bold, marginBottom: 2 },
  workerDept: { color: C.textSecondary, fontSize: 13 },

  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14 },
  statusDone: { backgroundColor: C.successBg },
  statusPending: { backgroundColor: C.warningBg },
  statusIconDone: { fontSize: 26, color: C.success },
  statusIconPending: { fontSize: 26, color: C.warning },
  statusTitleDone: { color: C.successText, fontSize: 14, fontWeight: FONT.bold, marginBottom: 2 },
  statusTitlePending: { color: C.warningText, fontSize: 14, fontWeight: FONT.bold, marginBottom: 2 },
  statusSub: { color: C.textSecondary, fontSize: 12 },

  detailCard: { backgroundColor: C.surface, borderRadius: RADIUS.lg, paddingHorizontal: 16, marginBottom: 14, ...SHADOW.sm },
  sectionLabel: { color: C.textMuted, fontSize: 11, fontWeight: FONT.bold, letterSpacing: 1, paddingTop: 14, marginBottom: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  divider: { height: 1, backgroundColor: C.divider },
  detailLabel: { color: C.textMuted, fontSize: 11, fontWeight: FONT.bold, letterSpacing: 0.8, flex: 1 },
  detailValue: { color: C.textPrimary, fontSize: 13, fontWeight: FONT.bold, flex: 2, textAlign: 'right' },
  detailEmpty: { color: C.textMuted, fontWeight: FONT.regular },
  detailInput: {
    flex: 2,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: FONT.medium,
    color: C.textPrimary,
    borderBottomWidth: 1.5,
    borderBottomColor: C.primary,
    paddingBottom: 2,
  },

  warnCard: { backgroundColor: C.warningBg, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.warning + '44' },
  warnTitle: { color: C.warningText, fontSize: 14, fontWeight: FONT.extraBold, marginBottom: 4 },
  warnText: { color: C.warningText, fontSize: 13, lineHeight: 18 },

  saveBtn: { backgroundColor: C.primary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginBottom: 12, ...SHADOW.lg },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: FONT.bold },

  logoutBtn: { backgroundColor: C.error, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 4, ...SHADOW.md },
  logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: FONT.extraBold },
});
