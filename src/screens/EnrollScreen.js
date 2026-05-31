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

const LIVENESS_THRESHOLD = 0.5;

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

export default function EnrollScreen({ initialUnlocked = false }) {
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
  };

  const handleCaptureFrame = async () => {
    if (!latestInference?.ready) {
      Alert.alert('Models Warming Up', 'Keep the worker face in view and try again.');
      return;
    }

    if (
      typeof latestInference.livenessScore !== 'number' ||
      latestInference.livenessScore < LIVENESS_THRESHOLD
    ) {
      Alert.alert('Liveness Failed', 'Ask the worker to face the camera clearly before capture.');
      return;
    }

    if (!Array.isArray(latestInference.embedding) || latestInference.embedding.length === 0) {
      Alert.alert('No Embedding', 'Recognition model did not return an embedding yet.');
      return;
    }

    try {
      await cameraRef.current?.capturePhoto();
    } catch (error) {
      Alert.alert('Camera Not Ready', 'Please wait for the camera preview.');
      return;
    }

    setCapturedEmbeddings((current) => [...current, latestInference.embedding]);
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

    setSaving(true);
    try {
      const embedding = averageEmbeddings(capturedEmbeddings);
      if (!embedding) {
        Alert.alert('Face Template Missing', 'Capture 5 valid face frames before saving.');
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
        `${name} (${employeeId.toUpperCase()}) enrolled successfully.`,
        [{ text: 'Done', onPress: resetForm }]
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
        Alert.alert('Error', 'Failed to save. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.root}
        showsVerticalScrollIndicator={false}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5E8" />

        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Enroll Worker</Text>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        </View>

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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Face Capture</Text>
          <Text style={styles.captureInfo}>
            Capture 5 live frames for accurate face recognition
          </Text>

          <View style={styles.cameraBox}>
            <CameraView ref={cameraRef} onInference={setLatestInference} />
          </View>

          <View style={styles.frameBox}>
            <Text style={styles.frameIcon}>[]</Text>
            <Text style={styles.frameText}>
              {step === 0
                ? 'Position worker face in frame'
                : step < 5
                ? `${step} of 5 frames captured`
                : 'All 5 frames captured'}
            </Text>
            <Text style={styles.modelStatus}>
              {latestInference?.ready
                ? `Models live | Liveness ${(latestInference.livenessScore * 100).toFixed(0)}%`
                : 'Models warming up'}
            </Text>
            <View style={styles.progressRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[styles.progressDot, i <= step && styles.progressDotActive]}
                />
              ))}
            </View>
          </View>

          {step < 5 && (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCaptureFrame}
            >
              <Text style={styles.captureButtonText}>
                CAPTURE FRAME {step + 1}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {step === 5 && (
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
  root: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 30 },
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  frameBox: {
    backgroundColor: '#F5F5E8',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D4DCC8',
    padding: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  cameraBox: {
    height: 220,
    overflow: 'hidden',
    backgroundColor: '#EEF0E8',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D4DCC8',
    marginBottom: 14,
  },
  frameIcon: { fontSize: 32, color: '#5C6B3A' },
  frameText: { color: '#7A8A6A', fontSize: 13 },
  modelStatus: {
    color: '#5C6B3A',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  progressRow: { flexDirection: 'row', gap: 10 },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D4DCC8',
  },
  progressDotActive: { backgroundColor: '#5C6B3A' },
  captureButton: {
    backgroundColor: '#EEF0E8',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#5C6B3A',
  },
  captureButtonText: {
    color: '#5C6B3A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
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
  footer: {
    color: '#A8B5A0',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
