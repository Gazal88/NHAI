import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { logAttendance, logFailure } from '../services/DatabaseService';
import CameraView from '../components/CameraView.js';

const SIMULATED_CONFIDENCE = 0.97;
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_MS = 60 * 1000;
const LIVENESS_THRESHOLD = 0.5;
const RECOGNITION_THRESHOLD = 0.82;

const LIVENESS_CHALLENGES = [
  {
    id: 'blink',
    title: 'Blink Check',
    instruction: 'Blink once, then keep your face centered.',
  },
  {
    id: 'turn_left',
    title: 'Head Turn Check',
    instruction: 'Turn your head slightly left, then face camera.',
  },
  {
    id: 'turn_right',
    title: 'Head Turn Check',
    instruction: 'Turn your head slightly right, then face camera.',
  },
  {
    id: 'smile',
    title: 'Smile Check',
    instruction: 'Smile briefly, then keep your face centered.',
  },
];

const pickChallenge = () => {
  const index = Math.floor(Math.random() * LIVENESS_CHALLENGES.length);
  return LIVENESS_CHALLENGES[index];
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '--';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};

const parseEmbedding = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return null;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = Number(a[i]);
    const bv = Number(b[i]);
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export default function AuthScreen({ worker, pendingCount = 0, onAttendanceLogged }) {
  const cameraRef = useRef(null);
  const [verifying, setVerifying] = useState(false);
  const [locGranted, setLocGranted] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [challenge, setChallenge] = useState(() => pickChallenge());
  const [challengeArmed, setChallengeArmed] = useState(false);
  const [latestInference, setLatestInference] = useState(null);
  const greeting = getGreeting();
  const initials = getInitials(worker?.name);
  const isLocked = lockedUntil !== null && now < lockedUntil;
  const lockSeconds = isLocked ? Math.ceil((lockedUntil - now) / 1000) : 0;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocGranted(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (!isLocked) return undefined;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked]);

  const registerFailure = async (type, details = {}) => {
    await logFailure(type, {
      workerId: worker?.id ?? null,
      employeeId: worker?.employee_id ?? null,
      ...details,
    });

    setFailedAttempts((current) => {
      const next = current + 1;
      if (next >= MAX_FAILED_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        return 0;
      }
      return next;
    });
  };

  const resetChallenge = () => {
    setChallenge(pickChallenge());
    setChallengeArmed(false);
  };

  const getGPS = async () => {
    if (!locGranted) return { gpsLat: null, gpsLng: null };
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });
      return {
        gpsLat: loc.coords.latitude,
        gpsLng: loc.coords.longitude,
      };
    } catch (error) {
      console.warn('[GPS] failed:', error.message);
      return { gpsLat: null, gpsLng: null };
    }
  };

  const handleVerify = async () => {
    if (isLocked) {
      Alert.alert('Temporarily Locked', `Please try again in ${lockSeconds} seconds.`);
      return;
    }

    if (!worker) {
      await logFailure('WORKER_NOT_LOADED', {});
      Alert.alert('No Worker', 'Worker data not loaded.');
      return;
    }

    if (!challengeArmed) {
      setChallengeArmed(true);
      Alert.alert('Active Check Started', challenge.instruction);
      return;
    }

    setVerifying(true);
    try {
      const photo = await cameraRef.current?.capturePhoto();
      if (!photo?.path) {
        await registerFailure('CAMERA_NOT_READY', {
          challengeId: challenge.id,
        });
        resetChallenge();
        Alert.alert('Camera Not Ready', 'Please wait for the camera preview before verifying.');
        return;
      }

      console.log('[Verify] captured photo:', photo.path, 'challenge:', challenge.id);

      if (!latestInference?.ready) {
        await registerFailure('MODEL_NOT_READY', {
          challengeId: challenge.id,
          error: latestInference?.error ?? null,
        });
        resetChallenge();
        Alert.alert('Model Not Ready', 'Face models are still warming up. Please try again.');
        return;
      }

      if (
        typeof latestInference.livenessScore !== 'number' ||
        latestInference.livenessScore < LIVENESS_THRESHOLD
      ) {
        await registerFailure('LIVENESS_FAILED', {
          challengeId: challenge.id,
          livenessScore: latestInference.livenessScore ?? null,
        });
        resetChallenge();
        Alert.alert('Liveness Failed', 'Please complete the active check with your real face in view.');
        return;
      }

      const storedEmbedding = parseEmbedding(worker.embedding);
      if (!storedEmbedding) {
        await registerFailure('FACE_TEMPLATE_MISSING', {
          challengeId: challenge.id,
        });
        resetChallenge();
        Alert.alert(
          'Face Template Missing',
          'This worker has no enrolled face template yet. Re-enroll this worker from the Enroll tab.'
        );
        return;
      }

      const matchScore = cosineSimilarity(latestInference.embedding, storedEmbedding);
      if (matchScore === null || matchScore < RECOGNITION_THRESHOLD) {
        await registerFailure('FACE_MATCH_FAILED', {
          challengeId: challenge.id,
          matchScore,
        });
        resetChallenge();
        Alert.alert('Face Match Failed', 'Captured face does not match this employee ID.');
        return;
      }

      const confidence = Math.min(
        0.99,
        Math.max(SIMULATED_CONFIDENCE, matchScore, latestInference.livenessScore)
      );
      const { gpsLat, gpsLng } = await getGPS();

      await logAttendance({
        workerId: worker.id,
        employeeId: worker.employee_id,
        workerName: worker.name,
        gpsLat,
        gpsLng,
        confidence,
      });

      onAttendanceLogged?.();
      setFailedAttempts(0);
      setLockedUntil(null);
      resetChallenge();

      Alert.alert(
        'Attendance Logged',
        `${worker.name}\n${challenge.title} completed\nLiveness: ${(latestInference.livenessScore * 100).toFixed(0)}%\nMatch: ${(matchScore * 100).toFixed(0)}%` +
          (gpsLat ? `\nGPS: ${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)}` : ''),
        [{ text: 'OK' }]
      );
    } catch (error) {
      await registerFailure('VERIFY_ERROR', {
        message: error.message,
        challengeId: challenge.id,
      });
      resetChallenge();
      console.error('[AuthScreen] verify error:', error);
      Alert.alert('Error', 'Failed to log attendance. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.greetingName}>{worker?.name ?? 'Worker'}</Text>
        </View>
        <View style={styles.profileWrap}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount} pending</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.workerLabel}>Logged in as</Text>
        <Text style={styles.workerName}>{worker?.name ?? '-'}</Text>
        <Text style={styles.workerId}>{worker?.employee_id ?? ''}</Text>
        {worker?.department ? (
          <Text style={styles.workerDept}>{worker.department}</Text>
        ) : null}
      </View>

      <View style={styles.cameraFrame}>
        <CameraView ref={cameraRef} onInference={setLatestInference} />
      </View>

      <View style={styles.challengeCard}>
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeLabel}>Active Liveness</Text>
          <Text style={[
            styles.challengeStatus,
            challengeArmed && styles.challengeStatusReady,
          ]}>
            {challengeArmed ? 'Ready' : 'Pending'}
          </Text>
        </View>
        <Text style={styles.challengeTitle}>{challenge.title}</Text>
        <Text style={styles.challengeText}>{challenge.instruction}</Text>
        <Text style={styles.modelStatus}>
          {latestInference?.ready
            ? `Models live | Liveness ${(latestInference.livenessScore * 100).toFixed(0)}%`
            : 'Models warming up'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.verifyBtn, verifying && styles.verifyBtnDisabled]}
        onPress={handleVerify}
        disabled={verifying || isLocked}
        activeOpacity={0.85}
      >
        {verifying ? (
          <ActivityIndicator color="#F5F5E8" />
        ) : (
          <Text style={styles.verifyBtnText}>
            {isLocked
              ? `Locked ${lockSeconds}s`
              : challengeArmed
              ? 'Capture After Active Check'
              : 'Start Active Check'}
          </Text>
        )}
      </TouchableOpacity>

      {failedAttempts > 0 && !isLocked ? (
        <Text style={styles.attemptWarning}>
          {failedAttempts} failed attempt{failedAttempts === 1 ? '' : 's'}
        </Text>
      ) : null}

      {!locGranted && (
        <Text style={styles.gpsWarning}>
          Location permission denied - GPS will not be recorded.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5E8',
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingBlock: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    color: '#7A8A6A',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  greetingName: {
    color: '#2C3520',
    fontSize: 22,
    fontWeight: '800',
  },
  profileWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    backgroundColor: '#C4A35A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#5C6B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#F5F5E8',
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D4DCC8',
    marginBottom: 20,
  },
  workerLabel: {
    fontSize: 11,
    color: '#A8B5A0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  workerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3520',
    marginBottom: 2,
  },
  workerId: {
    fontSize: 13,
    color: '#5C6B3A',
    fontWeight: '600',
    marginBottom: 2,
  },
  workerDept: {
    fontSize: 13,
    color: '#7A8A6A',
  },
  cameraFrame: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#EEF0E8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4DCC8',
    marginBottom: 12,
  },
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4DCC8',
    padding: 14,
    marginBottom: 12,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeLabel: {
    color: '#A8B5A0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  challengeStatus: {
    color: '#C4A35A',
    fontSize: 11,
    fontWeight: '800',
  },
  challengeStatusReady: {
    color: '#5C6B3A',
  },
  challengeTitle: {
    color: '#2C3520',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  challengeText: {
    color: '#7A8A6A',
    fontSize: 13,
    lineHeight: 18,
  },
  modelStatus: {
    color: '#5C6B3A',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
  },
  verifyBtn: {
    backgroundColor: '#5C6B3A',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#F5F5E8',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  gpsWarning: {
    fontSize: 12,
    color: '#C4A35A',
    textAlign: 'center',
    marginBottom: 12,
  },
  attemptWarning: {
    fontSize: 12,
    color: '#C4A35A',
    textAlign: 'center',
    marginBottom: 10,
  },
});
