import {
  StyleSheet, Text, View, TouchableOpacity, StatusBar,
  TextInput, Alert, KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { useRef, useState } from 'react';
import { enrollWorker } from '../services/DatabaseService';
import CameraView from '../components/CameraView';
import { C, FONT, RADIUS, SHADOW } from '../theme';

const LIVENESS_THRESHOLD = 0.45;
const REQUIRED_FRAMES = 5;

const averageEmbeddings = (embeddings) => {
  if (!embeddings.length) return null;
  const length = embeddings[0].length;
  const sums = new Array(length).fill(0);
  for (const embedding of embeddings) {
    if (!Array.isArray(embedding) || embedding.length !== length) return null;
    for (let i = 0; i < length; i++) sums[i] += Number(embedding[i]);
  }
  return sums.map((v) => v / embeddings.length);
};

export default function EnrollScreen({ initialUnlocked = false, onDone }) {
  const cameraRef = useRef(null);
  const [pin, setPin]                           = useState('');
  const [unlocked, setUnlocked]                 = useState(initialUnlocked);
  const [name, setName]                         = useState('');
  const [employeeId, setEmployeeId]             = useState('');
  const [department, setDepartment]             = useState('');
  const [passcode, setPasscode]                 = useState('');
  const [capturedEmbeddings, setCapturedEmbeddings] = useState([]);
  const [latestInference, setLatestInference]   = useState(null);
  const [saving, setSaving]                     = useState(false);
  const [capturing, setCapturing]               = useState(false);
  const step = capturedEmbeddings.length;

  const checkPin = () => {
    if (pin === 'ADMIN1234') { setUnlocked(true); return; }
    setPin('');
    Alert.alert('Wrong PIN', 'Please try again.');
  };

  const resetForm = () => {
    setName(''); setEmployeeId(''); setDepartment(''); setPasscode('');
    setCapturedEmbeddings([]); setUnlocked(initialUnlocked); setPin(''); setLatestInference(null);
  };

  const handleDone = () => { resetForm(); onDone?.(); };

  const handleCaptureFrame = async () => {
    if (capturing) return;
    if (!latestInference?.ready) { Alert.alert('Not Ready', 'Keep the worker face in view and try again.'); return; }
    if (latestInference.faceDetected === false) { Alert.alert('No Face Detected', 'Position the worker\'s face clearly in the frame.'); return; }
    if (typeof latestInference.livenessScore !== 'number' || latestInference.livenessScore < LIVENESS_THRESHOLD) {
      Alert.alert('Liveness Check Failed', 'Ask the worker to face the camera clearly in good lighting.');
      return;
    }
    if (!Array.isArray(latestInference.embedding) || latestInference.embedding.length === 0) {
      Alert.alert('Not Ready', 'Recognition model is still loading. Wait a moment.');
      return;
    }
    setCapturing(true);
    try {
      await cameraRef.current?.capturePhoto();
      setCapturedEmbeddings((c) => [...c, latestInference.embedding]);
    } catch { Alert.alert('Camera Not Ready', 'Please wait for the camera preview.'); }
    finally { setCapturing(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Enter worker name.'); return; }
    if (!employeeId.trim()) { Alert.alert('Required', 'Enter Employee ID.'); return; }
    if (!passcode.trim()) { Alert.alert('Required', 'Enter worker passcode.'); return; }
    if (capturedEmbeddings.length < REQUIRED_FRAMES) { Alert.alert('Incomplete', `Capture all ${REQUIRED_FRAMES} frames first.`); return; }
    setSaving(true);
    try {
      const embedding = averageEmbeddings(capturedEmbeddings);
      if (!embedding) { Alert.alert('Error', 'Inconsistent frames. Re-capture all.'); setSaving(false); return; }
      await enrollWorker(employeeId.trim(), name.trim(), department.trim(), passcode.trim(), embedding);
      Alert.alert('Enrolled', `${name.trim()} (${employeeId.trim().toUpperCase()}) enrolled successfully.`, [{ text: 'Done', onPress: handleDone }]);
    } catch (e) {
      if (e.message?.includes('UNIQUE')) Alert.alert('Duplicate ID', 'Employee ID already exists.');
      else if (e.code === 'NAME_MATCH') Alert.alert('Possible Duplicate', `${e.duplicate?.worker?.name ?? 'This worker'} is already enrolled.`);
      else if (e.code === 'FACE_MATCH') Alert.alert('Duplicate Face', `This face matches ${e.duplicate?.worker?.name ?? 'an existing worker'}. Blocked.`);
      else Alert.alert('Error', 'Failed to save. Try again.');
    } finally { setSaving(false); }
  };

  // ── PIN gate ──────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <KeyboardAvoidingView style={styles.pinRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle="light-content" backgroundColor={C.adminPrimary} />
        <View style={styles.pinHeader}>
          <View style={styles.pinIconWrap}>
            <Text style={styles.pinIcon}>🔒</Text>
          </View>
          <Text style={styles.pinTitle}>Admin Access</Text>
          <Text style={styles.pinSub}>Enter admin PIN to enrol new field workers</Text>
        </View>
        <View style={styles.pinCard}>
          <Text style={styles.label}>ADMIN PIN</Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            placeholderTextColor={C.textMuted}
            secureTextEntry
            onSubmitEditing={checkPin}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={checkPin}>
            <Text style={styles.primaryBtnText}>Unlock</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.pinFooter}>Only authorised administrators can enrol workers</Text>
      </KeyboardAvoidingView>
    );
  }

  // ── Enrollment form ───────────────────────────────────────────────────────
  const faceReady   = latestInference?.ready === true;
  const faceDetected = latestInference?.faceDetected === true;
  const livenessOk  = typeof latestInference?.livenessScore === 'number' && latestInference.livenessScore >= LIVENESS_THRESHOLD;
  const captureReady = faceReady && livenessOk;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

        {/* Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topBarSub}>Admin</Text>
            <Text style={styles.topBarTitle}>Enrol Worker</Text>
          </View>
          <View style={styles.topBarRight}>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
            {onDone && (
              <TouchableOpacity onPress={handleDone} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Worker details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Worker Details</Text>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Rajesh Kumar" placeholderTextColor={C.textMuted} />
          <Text style={styles.label}>EMPLOYEE ID</Text>
          <TextInput style={styles.input} value={employeeId} onChangeText={setEmployeeId} placeholder="e.g. EMP001" placeholderTextColor={C.textMuted} autoCapitalize="characters" autoCorrect={false} />
          <Text style={styles.label}>DEPARTMENT (OPTIONAL)</Text>
          <TextInput style={styles.input} value={department} onChangeText={setDepartment} placeholder="e.g. Field Operations" placeholderTextColor={C.textMuted} />
          <Text style={styles.label}>WORKER PASSCODE</Text>
          <TextInput style={[styles.input, { marginBottom: 0 }]} value={passcode} onChangeText={setPasscode} placeholder="e.g. 1234" placeholderTextColor={C.textMuted} secureTextEntry keyboardType="number-pad" />
        </View>

        {/* Face capture */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Face Capture</Text>
          <Text style={styles.captureInfo}>Capture {REQUIRED_FRAMES} live frames. Ensure good lighting and clear face visibility.</Text>

          <View style={styles.cameraBox}>
            <CameraView ref={cameraRef} onInference={setLatestInference} />
          </View>

          {/* Status pills */}
          <View style={styles.pillRow}>
            <View style={[styles.pill, faceReady ? styles.pillOk : styles.pillWarn]}>
              <Text style={styles.pillTxt}>{faceReady ? 'Ready' : 'Starting…'}</Text>
            </View>
            <View style={[styles.pill, faceDetected ? styles.pillOk : styles.pillGrey]}>
              <Text style={styles.pillTxt}>{faceDetected ? 'Face ✓' : 'No face'}</Text>
            </View>
            <View style={[styles.pill, livenessOk ? styles.pillOk : styles.pillGrey]}>
              <Text style={styles.pillTxt}>{faceReady ? (livenessOk ? 'Live ✓' : 'Checking…') : '—'}</Text>
            </View>
          </View>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: REQUIRED_FRAMES }, (_, i) => (
              <View key={i} style={[styles.dot, i < step && styles.dotActive]} />
            ))}
          </View>
          <Text style={styles.frameText}>
            {step === 0 ? 'Position worker face in frame' : step < REQUIRED_FRAMES ? `${step} of ${REQUIRED_FRAMES} frames captured` : `All ${REQUIRED_FRAMES} frames captured`}
          </Text>

          {step < REQUIRED_FRAMES && (
            <TouchableOpacity
              style={[styles.captureBtn, (!captureReady || capturing) && styles.captureBtnDisabled]}
              onPress={handleCaptureFrame}
              disabled={!captureReady || capturing}
            >
              <Text style={styles.captureBtnText}>{capturing ? 'CAPTURING…' : `CAPTURE FRAME ${step + 1}`}</Text>
            </TouchableOpacity>
          )}

          {step > 0 && step < REQUIRED_FRAMES && (
            <TouchableOpacity style={styles.removeBtn} onPress={() => setCapturedEmbeddings((c) => c.slice(0, -1))}>
              <Text style={styles.removeBtnText}>Remove last frame</Text>
            </TouchableOpacity>
          )}

          {step === REQUIRED_FRAMES && (
            <View style={styles.allCapturedRow}>
              <Text style={styles.allCapturedText}>All frames captured ✓</Text>
              <TouchableOpacity onPress={() => setCapturedEmbeddings([])}>
                <Text style={styles.recaptureText}>Re-capture</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {step === REQUIRED_FRAMES && (
          <TouchableOpacity style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save Worker'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => { setUnlocked(initialUnlocked); setPin(''); }} style={styles.exitRow}>
          <Text style={styles.exitText}>{initialUnlocked ? 'Admin Mode Active' : 'Exit Admin Mode'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // PIN gate
  pinRoot: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, justifyContent: 'center' },
  pinHeader: { alignItems: 'center', marginBottom: 28 },
  pinIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.adminPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...SHADOW.lg },
  pinIcon: { fontSize: 30 },
  pinTitle: { color: C.textPrimary, fontSize: 26, fontWeight: FONT.extraBold, marginBottom: 8 },
  pinSub: { color: C.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  pinCard: { backgroundColor: C.surface, borderRadius: RADIUS.xl, padding: 24, marginBottom: 16, ...SHADOW.md },
  pinFooter: { color: C.textMuted, fontSize: 12, textAlign: 'center' },

  // Scroll
  scroll: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 32 },

  // Header
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  topBarSub: { color: C.textSecondary, fontSize: 12, fontWeight: FONT.semiBold, marginBottom: 2 },
  topBarTitle: { color: C.textPrimary, fontSize: 26, fontWeight: FONT.extraBold },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adminBadge: { backgroundColor: C.adminPrimary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm },
  adminBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: FONT.extraBold, letterSpacing: 1.5 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: C.primary, fontSize: 15, fontWeight: FONT.bold },

  // Card
  card: { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 20, marginBottom: 14, ...SHADOW.sm },
  sectionTitle: { color: C.textPrimary, fontSize: 15, fontWeight: FONT.bold, marginBottom: 16 },
  captureInfo: { color: C.textSecondary, fontSize: 12, marginBottom: 14, lineHeight: 18 },

  // Form
  label: { color: C.textSecondary, fontSize: 11, fontWeight: FONT.bold, letterSpacing: 1.2, marginBottom: 6 },
  input: {
    backgroundColor: C.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: FONT.medium,
    marginBottom: 16,
  },

  // Camera
  cameraBox: { height: 220, overflow: 'hidden', backgroundColor: '#0A1628', borderRadius: RADIUS.md, marginBottom: 12 },

  // Status pills
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  pillOk:   { backgroundColor: C.successBg },
  pillWarn: { backgroundColor: C.warningBg },
  pillGrey: { backgroundColor: C.divider },
  pillTxt:  { fontSize: 11, fontWeight: FONT.bold, color: C.textPrimary },

  // Progress dots
  dotsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.border },
  dotActive: { backgroundColor: C.primary },
  frameText: { color: C.textSecondary, fontSize: 13, marginBottom: 14 },

  // Capture button
  captureBtn: { backgroundColor: C.primaryLight, paddingVertical: 13, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1.5, borderColor: C.primary, marginBottom: 8 },
  captureBtnDisabled: { opacity: 0.4, borderColor: C.border },
  captureBtnText: { color: C.primary, fontSize: 13, fontWeight: FONT.extraBold, letterSpacing: 1.5 },

  removeBtn: { alignItems: 'center', paddingVertical: 6 },
  removeBtnText: { color: C.error, fontSize: 12, fontWeight: FONT.bold },

  allCapturedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  allCapturedText: { color: C.successText, fontSize: 13, fontWeight: FONT.bold },
  recaptureText: { color: C.warning, fontSize: 12, fontWeight: FONT.bold },

  // Primary button
  primaryBtn: { backgroundColor: C.primary, paddingVertical: 16, borderRadius: RADIUS.lg, alignItems: 'center', marginBottom: 14, ...SHADOW.lg },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: FONT.bold },

  exitRow: { alignItems: 'center', paddingVertical: 8 },
  exitText: { color: C.textMuted, fontSize: 13 },
});
