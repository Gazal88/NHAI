import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRef, useState } from 'react';
import { enrollWorker } from '../services/DatabaseService';
import CameraView from '../components/CameraView';

const LIVENESS_THRESHOLD = 0.45;
const REQUIRED_FRAMES = 5;

const averageEmbeddings = (embeddings) => {
  if (!embeddings.length) return null;
  const length = embeddings[0].length;
  const sums = new Array(length).fill(0);

  for (const embedding of embeddings) {
    if (!Array.isArray(embedding) || embedding.length !== length) return null;
    for (let i = 0; i < length; i += 1) {
      sums[i] += Number(embedding[i]);
    }
  }

  return sums.map((value) => value / embeddings.length);
};

export default function EnrollScreen({ initialUnlocked = false, onDone }) {
  const cameraRef = useRef(null);
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [passcode, setPasscode] = useState('');
  const [capturedEmbeddings, setCapturedEmbeddings] = useState([]);
  const [latestInference, setLatestInference] = useState(null);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const step = capturedEmbeddings.length;

  const checkPin = () => {
    if (pin === 'ADMIN1234') {
      setUnlocked(true);
      return;
    }
    setPin('');
    Alert.alert('Wrong PIN', 'Please try again.');
  };

  const resetForm = () => {
    setName('');
    setEmployeeId('');
    setDepartment('');
    setPasscode('');
    setCapturedEmbeddings([]);
    setUnlocked(initialUnlocked);
    setPin('');
    setLatestInference(null);
  };

  const handleDone = () => {
    resetForm();
    onDone?.();
  };

  const handleCaptureFrame = async () => {
    if (capturing) return;

    // ── Quality gate 1: models must be ready ──────────────────────────────
    if (!latestInference?.ready) {
      Alert.alert('Models Warming Up', 'Keep the worker face in view and try again.');
      return;
    }

    // ── Quality gate 2: face must be detected by BlazeFace ────────────────
    // faceDetected is true when BlazeFace found a face; if BlazeFace hasn't
    // loaded yet it will be undefined/false — we warn but don't hard-block
    // so enrollment still works if BlazeFace is slow to load.
    if (latestInference.faceDetected === false) {
      Alert.alert(
        'No Face Detected',
        'Position the worker\'s face clearly in the frame and try again.'
      );
      return;
    }

    // ── Quality gate 3: liveness score ───────────────────────────────────
    if (
      typeof latestInference.livenessScore !== 'number' ||
      latestInference.livenessScore < LIVENESS_THRESHOLD
    ) {
      Alert.alert(
        'Liveness Check Failed',
        `Liveness score too low (${((latestInference.livenessScore ?? 0) * 100).toFixed(0)}%). Ask the worker to face the camera clearly in good lighting.`
      );
      return;
    }

    // ── Quality gate 4: embedding must be present ─────────────────────────
    if (!Array.isArray(latestInference.embedding) || latestInference.embedding.length === 0) {
      Alert.alert('No Embedding', 'Recognition model did not return an embedding yet. Wait a moment.');
      return;
    }

    setCapturing(true);
    try {
      await cameraRef.current?.capturePhoto();
      setCapturedEmbeddings((current) => [...current, latestInference.embedding]);
    } catch (error) {
      Alert.alert('Camera Not Ready', 'Please wait for the camera preview.');
    } finally {
      setCapturing(false);
    }
  };

  const handleRemoveLastFrame = () => {
    setCapturedEmbeddings((current) => current.slice(0, -1));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Enter worker name.');
      return;
    }
    if (!employeeId.trim()) {
      Alert.alert('Required', 'Enter Employee ID.');
      return;
    }
    if (!passcode.trim()) {
      Alert.alert('Required', 'Enter worker passcode.');
      return;
    }
    if (capturedEmbeddings.length < REQUIRED_FRAMES) {
      Alert.alert('Face Template Incomplete', `Capture all ${REQUIRED_FRAMES} frames before saving.`);
      return;
    }

    setSaving(true);
    try {
      const embedding = averageEmbeddings(capturedEmbeddings);
      if (!embedding) {
        Alert.alert('Face Template Error', 'Embedding dimensions are inconsistent. Re-capture all frames.');
        setSaving(false);
        return;
      }

      await enrollWorker(
        employeeId.trim(),
        name.trim(),
        department.trim(),
        passcode.trim(),
        embedding
      );

      Alert.alert(
        'Enrolled',
        `${name.trim()} (${employeeId.trim().toUpperCase()}) enrolled successfully.`,
        [{ text: 'Done', onPress: handleDone }]
      );
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        Alert.alert('Duplicate ID', 'Employee ID already exists. Use a different ID.');
      } else if (e.code === 'NAME_MATCH') {
        Alert.alert(
          'Possible Duplicate Worker',
          `${e.duplicate?.worker?.name ?? 'This worker'} is already enrolled as ${e.duplicate?.worker?.employee_id ?? 'another Employee ID'}. Use the existing worker record instead.`
        );
      } else if (e.code === 'FACE_MATCH') {
        Alert.alert(
          'Duplicate Face Detected',
          `This face appears to match ${e.duplicate?.worker?.name ?? 'an existing worker'} (${e.duplicate?.worker?.employee_id ?? 'existing ID'}). Enrollment blocked.`
        );
      } else {
        console.error('[Enroll] save error:', e);
        Alert.alert('Error', 'Failed to save. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── PIN gate ─────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5E8" />
        <View style={styles.lockTop}>
          <View style={styles.lockIcon}>
            <Text style={styles.lockIconText}>PIN</Text>
          </View>
          <Text style={styles.lockTitle}>Admin Access</Text>
          <Text style={styles.lockSub}>
            Enter admin PIN to enroll new field workers
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.inputLabel}>ADMIN PIN</Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            placeholder="Admin PIN"
            placeholderTextColor="#A8B5A0"
            secureTextEntry
            onSubmitEditing={checkPin}
          />
          <TouchableOpacity style={styles.button} onPress={checkPin}>
            <Text style={styles.buttonText}>UNLOCK</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footer}>
          Only site administrators have access to enrollment
        </Text>
      </KeyboardAvoidingView>
    );
  }

  // ── Enrollment form ───────────────────────────────────────────────────────
  const faceReady = latestInference?.ready === true;
  const faceDetected = latestInference?.faceDetected === true;
  const livenessOk =
    typeof latestInference?.livenessScore === 'number' &&
    latestInference.livenessScore >= LIVENESS_THRESHOLD;
  const captureReady = faceReady && livenessOk;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5E8" />

        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Enroll Worker</Text>
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

        {/* ── Worker details ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Worker Details</Text>

          <Text style={styles.inputLabel}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rajesh Kumar"
            placeholderTextColor="#A8B5A0"
          />

          <Text style={styles.inputLabel}>EMPLOYEE ID</Text>
          <TextInput
            style={styles.input}
            value={employeeId}
            onChangeText={setEmployeeId}
            placeholder="e.g. EMP001"
            placeholderTextColor="#A8B5A0"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>DEPARTMENT (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="e.g. Field Operations"
            placeholderTextColor="#A8B5A0"
          />

          <Text style={styles.inputLabel}>WORKER PASSCODE</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            value={passcode}
            onChangeText={setPasscode}
            placeholder="e.g. 1234"
            placeholderTextColor="#A8B5A0"
            secureTextEntry
            keyboardType="number-pad"
          />
        </View>

        {/* ── Face capture ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Face Capture</Text>
          <Text style={styles.captureInfo}>
            Capture {REQUIRED_FRAMES} live frames. Face must be clearly visible with good lighting.
          </Text>

          <View style={styles.cameraBox}>
            <CameraView ref={cameraRef} onInference={setLatestInference} />
          </View>

          {/* Status row */}
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, faceReady ? styles.pillGreen : styles.pillAmber]}>
              <Text style={styles.statusPillText}>
                {faceReady ? 'Models ready' : 'Warming up'}
              </Text>
            </View>
            <View style={[styles.statusPill, faceDetected ? styles.pillGreen : styles.pillGrey]}>
              <Text style={styles.statusPillText}>
                {faceDetected ? 'Face ✓' : 'No face'}
              </Text>
            </View>
            <View style={[styles.statusPill, livenessOk ? styles.pillGreen : styles.pillGrey]}>
              <Text style={styles.statusPillText}>
                {faceReady ? (livenessOk ? 'Live ✓' : 'Checking…') : 'Liveness —'}
              </Text>
            </View>
          </View>

          {/* Progress dots */}
          <View style={styles.progressRow}>
            {Array.from({ length: REQUIRED_FRAMES }, (_, i) => (
              <View
                key={i}
                style={[styles.progressDot, i < step && styles.progressDotActive]}
              />
            ))}
          </View>
          <Text style={styles.frameText}>
            {step === 0
              ? 'Position worker face in frame'
              : step < REQUIRED_FRAMES
              ? `${step} of ${REQUIRED_FRAMES} frames captured`
              : `All ${REQUIRED_FRAMES} frames captured`}
          </Text>

          {/* Capture / re-capture buttons */}
          {step < REQUIRED_FRAMES && (
            <TouchableOpacity
              style={[
                styles.captureButton,
                (!captureReady || capturing) && styles.captureButtonDisabled,
              ]}
              onPress={handleCaptureFrame}
              disabled={!captureReady || capturing}
            >
              <Text style={styles.captureButtonText}>
                {capturing ? 'CAPTURING...' : `CAPTURE FRAME ${step + 1}`}
              </Text>
            </TouchableOpacity>
          )}

          {step > 0 && step < REQUIRED_FRAMES && (
            <TouchableOpacity style={styles.removeFrameBtn} onPress={handleRemoveLastFrame}>
              <Text style={styles.removeFrameText}>Remove last frame</Text>
            </TouchableOpacity>
          )}

          {step === REQUIRED_FRAMES && (
            <View style={styles.allCapturedRow}>
              <Text style={styles.allCapturedText}>All frames captured</Text>
              <TouchableOpacity onPress={() => setCapturedEmbeddings([])}>
                <Text style={styles.recaptureText}>Re-capture all</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Save button ── */}
        {step === REQUIRED_FRAMES && (
          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving ? 'SAVING...' : 'SAVE WORKER'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => {
            setUnlocked(initialUnlocked);
            setPin('');
          }}
          style={styles.logoutRow}
        >
          <Text style={styles.logoutText}>
            {initialUnlocked ? 'Admin Mode Active' : 'Exit Admin Mode'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F5E8' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 30 },
  // PIN gate
  root: {
    flex: 1,
    backgroundColor: '#F5F5E8',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  lockTop: { alignItems: 'center', marginBottom: 28 },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#5C6B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 6,
    shadowColor: '#5C6B3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  lockIconText: { fontSize: 18, color: '#F5F5E8', fontWeight: '900' },
  lockTitle: {
    color: '#2C3520',
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    marginBottom: 8,
  },
  lockSub: {
    color: '#7A8A6A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    color: '#A8B5A0',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  // Shared
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    color: '#2C3520',
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  adminBadge: {
    backgroundColor: '#5C6B3A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  adminBadgeText: {
    color: '#F5F5E8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#5C6B3A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  sectionTitle: {
    color: '#2C3520',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  captureInfo: {
    color: '#7A8A6A',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 18,
  },
  inputLabel: {
    color: '#5C6B3A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  input: {
    backgroundColor: '#F5F5E8',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D4DCC8',
    paddingVertical: 13,
    paddingHorizontal: 14,
    color: '#2C3520',
    fontSize: 15,
    marginBottom: 16,
  },
  cameraBox: {
    height: 220,
    overflow: 'hidden',
    backgroundColor: '#EEF0E8',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D4DCC8',
    marginBottom: 12,
  },
  // Status pills
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillGreen: { backgroundColor: '#EEF0E8' },
  pillAmber: { backgroundColor: '#FFF3CD' },
  pillGrey:  { backgroundColor: '#F0F0F0' },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2C3520',
  },
  // Progress
  progressRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D4DCC8',
  },
  progressDotActive: { backgroundColor: '#5C6B3A' },
  frameText: {
    color: '#7A8A6A',
    fontSize: 13,
    marginBottom: 14,
  },
  // Capture button
  captureButton: {
    backgroundColor: '#EEF0E8',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#5C6B3A',
    marginBottom: 8,
  },
  captureButtonDisabled: {
    opacity: 0.45,
    borderColor: '#A8B5A0',
  },
  captureButtonText: {
    color: '#5C6B3A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  removeFrameBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  removeFrameText: {
    color: '#B65F4A',
    fontSize: 12,
    fontWeight: '700',
  },
  allCapturedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  allCapturedText: {
    color: '#5C6B3A',
    fontSize: 13,
    fontWeight: '700',
  },
  recaptureText: {
    color: '#C4A35A',
    fontSize: 12,
    fontWeight: '700',
  },
  // Save / action buttons
  button: {
    backgroundColor: '#5C6B3A',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#5C6B3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    marginBottom: 14,
  },
  buttonDisabled: { backgroundColor: '#A8B5A0' },
  buttonText: {
    color: '#F5F5E8',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  logoutRow: { alignItems: 'center', paddingVertical: 8 },
  logoutText: { color: '#A8B5A0', fontSize: 13 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#5C6B3A', fontSize: 16, fontWeight: '700' },
});
