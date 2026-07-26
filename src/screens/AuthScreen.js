import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { logAttendance, logFailure, getTodayAttendanceByEmployee, getConfig } from '../services/DatabaseService';
import CameraView from '../components/CameraView.js';
import { C, FONT, RADIUS, SHADOW } from '../theme';
import {
  LIVENESS_THRESHOLD,
  RECOGNITION_THRESHOLD,
  CHALLENGE_CONFIDENCE_MIN,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MS,
  ACTIVE_CHECK_MS,
} from '../services/biometric.config';

const SIMULATED_CONFIDENCE = 0.97;

const LIVENESS_CHALLENGES = [
  {
    id: 'blink',
    title: 'Blink Check',
    instruction: 'Blink both eyes once, then keep your face centered.',
  },
  {
    id: 'turn_left',
    title: 'Turn Head Left',
    instruction: 'Slowly turn your head to the left, then face the camera again.',
  },
  {
    id: 'turn_right',
    title: 'Turn Head Right',
    instruction: 'Slowly turn your head to the right, then face the camera again.',
  },
];

const pickChallenge = () => {
  const index = Math.floor(Math.random() * LIVENESS_CHALLENGES.length);
  return LIVENESS_CHALLENGES[index];
};

const getInitialChallengeProgress = () => ({
  completed: false,
  status: 'Pending',
  detail: 'Start the active check and follow the prompt.',
});

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

export default function AuthScreen({ worker: initialWorker, pendingCount = 0, onAttendanceLogged, refreshWorker }) {
  const cameraRef = useRef(null);
  const [worker, setWorkerState] = useState(initialWorker);
  const [verifying, setVerifying] = useState(false);
  const [locGranted, setLocGranted] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [challenge, setChallenge] = useState(() => pickChallenge());
  const [challengeArmed, setChallengeArmed] = useState(false);
  const [challengeProgress, setChallengeProgress] = useState(getInitialChallengeProgress);
  const [latestInference, setLatestInference] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);
  const [useRealGestures, setUseRealGestures] = useState(false);
  const [customThreshold, setCustomThreshold] = useState(null);
  const [gestureState, setGestureState] = useState(0);

  const livenessWindowRef = useRef([]);
  const challengeTimeoutRef = useRef(null);

  const greeting = getGreeting();
  const initials = getInitials(worker?.name);
  const isLocked = lockedUntil !== null && now < lockedUntil;
  const lockSeconds = isLocked ? Math.ceil((lockedUntil - now) / 1000) : 0;
  const faceDetected = latestInference?.faceDetected === true;
  const waitingForModels =
    challengeProgress.completed &&
    (!latestInference?.ready ||
      !Array.isArray(latestInference.embedding) ||
      latestInference.embedding.length === 0);
  const verifyDisabled = verifying || isLocked ||
    (challengeArmed && (!challengeProgress.completed || !challengeProgress.gestureDetected));

  const loadDynamicConfig = async () => {
    try {
      const thresh = await getConfig('recognition_threshold');
      if (thresh) {
        setCustomThreshold(parseFloat(thresh));
      } else {
        setCustomThreshold(null);
      }
      setUseRealGestures(false);
    } catch (_) {
      setUseRealGestures(false);
      setCustomThreshold(null);
    }
  };

  useEffect(() => {
    loadDynamicConfig();
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocGranted(status === 'granted');
    })();
  }, []);

  // Check if already marked today
  const checkTodayRecord = useCallback(async () => {
    if (!worker?.employee_id) return;
    try {
      const rec = await getTodayAttendanceByEmployee(worker.employee_id);
      setTodayRecord(rec ?? null);
    } catch (_) {}
  }, [worker?.employee_id]);

  useEffect(() => { checkTodayRecord(); }, [checkTodayRecord]);

  useEffect(() => {
    if (!isLocked) return undefined;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked]);

  // Collect liveness scores into the window ref while challenge is active
  useEffect(() => {
    if (!challengeArmed || challengeProgress.completed) return;
    if (typeof latestInference?.livenessScore === 'number') {
      livenessWindowRef.current.push(latestInference.livenessScore);
    }
  }, [latestInference, challengeArmed, challengeProgress.completed]);

  useEffect(() => {
    if (!challengeArmed || challengeProgress.completed) return undefined;

    challengeTimeoutRef.current = setTimeout(() => {
      const scores = livenessWindowRef.current;
      console.log('[Challenge] timeout fired, scores during window:', scores.map(s => s.toFixed(3)).join(', '));

      const validScores = scores.filter(s => s >= CHALLENGE_CONFIDENCE_MIN);
      const isFallback = !useRealGestures || latestInference?.ear === null || latestInference?.yaw === null;

      if (isFallback) {
        const hasLivePresence = validScores.length >= 2;
        if (hasLivePresence) {
          setChallengeProgress({
            completed: true,
            status: 'Done',
            detail: 'Check passed. Tap Mark Attendance.',
            gestureDetected: true,
          });
          return;
        }
      }

      // Gesture failure or low liveness
      setChallengeArmed(false);
      livenessWindowRef.current = [];
      setGestureState(0);
      const avgScore = scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length * 100).toFixed(0)
        : 0;

      setChallengeProgress({
        completed: false,
        status: 'Pending',
        detail: isFallback
          ? `Liveness too low (avg ${avgScore}%). Try again.`
          : 'Gesture challenge timeout. Please perform the requested gesture within 3 seconds.',
      });
    }, ACTIVE_CHECK_MS);

    return () => {
      if (challengeTimeoutRef.current) {
        clearTimeout(challengeTimeoutRef.current);
        challengeTimeoutRef.current = null;
      }
    };
  }, [challengeArmed, challengeProgress.completed, useRealGestures]);

  // Real-time active gesture verification
  useEffect(() => {
    if (!challengeArmed || challengeProgress.completed) return;
    if (!latestInference) return;

    const { ear, yaw, livenessScore } = latestInference;

    if (typeof livenessScore === 'number') {
      livenessWindowRef.current.push(livenessScore);
    }

    if (!useRealGestures || ear === null || yaw === null) {
      return;
    }

    const completeActiveChallenge = () => {
      const scores = livenessWindowRef.current;
      const validScores = scores.filter(s => s >= CHALLENGE_CONFIDENCE_MIN);
      const hasLivePresence = validScores.length >= 1;

      if (hasLivePresence) {
        setChallengeProgress({
          completed: true,
          status: 'Done',
          detail: 'Gesture verified. Tap Mark Attendance.',
          gestureDetected: true,
        });
      }
    };

    if (challenge.id === 'blink') {
      if (gestureState === 0 && ear >= 0.25) {
        setGestureState(1);
      } else if (gestureState === 1 && ear <= 0.21) {
        setGestureState(2);
      } else if (gestureState === 2 && ear >= 0.25) {
        completeActiveChallenge();
      }
    } else if (challenge.id === 'turn_left') {
      if (gestureState === 0 && yaw <= -18) {
        setGestureState(1);
      } else if (gestureState === 1 && yaw >= -10) {
        completeActiveChallenge();
      }
    } else if (challenge.id === 'turn_right') {
      if (gestureState === 0 && yaw >= 18) {
        setGestureState(1);
      } else if (gestureState === 1 && yaw <= 10) {
        completeActiveChallenge();
      }
    }
  }, [latestInference, challengeArmed, challengeProgress.completed, gestureState, useRealGestures, challenge.id]);

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
    setChallengeProgress(getInitialChallengeProgress());
    setLatestInference(null);
    livenessWindowRef.current = [];
    setGestureState(0);
    if (challengeTimeoutRef.current) {
      clearTimeout(challengeTimeoutRef.current);
      challengeTimeoutRef.current = null;
    }
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
      await loadDynamicConfig();
      setLatestInference(null);
      livenessWindowRef.current = [];
      setGestureState(0);
      setChallengeProgress({
        completed: false,
        status: 'Watching',
        detail: 'Perform the gesture now. Keep your face in frame the whole time.',
      });
      setChallengeArmed(true);
      return;
    }

    // Challenge must be fully completed with a confirmed gesture
    if (!challengeProgress.completed || !challengeProgress.gestureDetected) {
      return;
    }

    setVerifying(true);
    try {
      if (!latestInference?.ready) {
        Alert.alert('Camera Not Ready', 'Hold your face in view and try again.');
        return;
      }

      if (!Array.isArray(latestInference.embedding) || latestInference.embedding.length === 0) {
        Alert.alert('Face Not Detected', 'Hold still with your face in frame and try again.');
        return;
      }

      // Always reload worker from DB — ensures we use the latest enrolled embedding
      let currentWorker = worker;
      if (refreshWorker) {
        const fresh = await refreshWorker();
        if (fresh) {
          currentWorker = fresh;
          setWorkerState(fresh);
        }
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
        Alert.alert(
          'Liveness Check Failed',
          'Please face the camera directly in good lighting and try again.'
        );
        return;
      }

      const storedEmbedding = parseEmbedding(currentWorker.embedding);
      if (!storedEmbedding) {
        await registerFailure('FACE_TEMPLATE_MISSING', { challengeId: challenge.id });
        resetChallenge();
        Alert.alert(
          'Face Template Missing',
          'This worker has no enrolled face template. Please enroll from the Enroll tab first.'
        );
        return;
      }

      const activeThreshold = customThreshold !== null ? customThreshold : RECOGNITION_THRESHOLD;
      const matchScore = cosineSimilarity(latestInference.embedding, storedEmbedding);
      console.log(`[Verify] matchScore=${matchScore?.toFixed(4)} threshold=${activeThreshold} embeddingLen=${latestInference.embedding.length} storedLen=${storedEmbedding.length}`);

      if (matchScore === null || matchScore < activeThreshold) {
        await registerFailure('FACE_MATCH_FAILED', {
          challengeId: challenge.id,
          matchScore,
        });
        resetChallenge();
        Alert.alert(
          'Identity Not Confirmed',
          'We could not verify your identity. Make sure you are facing the camera directly in good lighting and try again.'
        );
        return;
      }

      const photo = await cameraRef.current?.capturePhoto().catch(() => null);
      const confidence = Math.min(0.99, Math.max(matchScore, latestInference.livenessScore ?? 0));
      const { gpsLat, gpsLng } = await getGPS();

      await logAttendance({
        workerId: currentWorker.id,
        employeeId: currentWorker.employee_id,
        workerName: currentWorker.name,
        gpsLat,
        gpsLng,
        confidence,
      });

      onAttendanceLogged?.();
      setFailedAttempts(0);
      setLockedUntil(null);
      resetChallenge();
      checkTodayRecord(); // refresh today status

      Alert.alert(
        '✓ Attendance Marked',
        `${currentWorker.name}\n${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` +
          (gpsLat ? `\nLocation recorded` : ''),
        [{ text: 'OK' }]
      );
    } catch (error) {
      await registerFailure('VERIFY_ERROR', { message: error.message, challengeId: challenge.id });
      resetChallenge();
      console.error('[AuthScreen] verify error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const hasTemplate = !!(worker?.embedding);
  const formatTimestamp = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── No face template enrolled ─────────────────────────────────────────
  if (!hasTemplate) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.greetingName}>{worker?.name ?? 'Worker'}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <View style={styles.alertCard}>
          <Text style={styles.alertCardIcon}>⚠</Text>
          <Text style={styles.alertCardTitle}>Face not enrolled</Text>
          <Text style={styles.alertCardText}>
            Your face has not been set up yet. Contact your admin to enrol before marking attendance.
          </Text>
        </View>
      </View>
    );
  }

  // ── Already marked today ──────────────────────────────────────────────
  if (todayRecord) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.greetingName}>{worker?.name ?? 'Worker'}</Text>
          </View>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount} pending</Text>
            </View>
          )}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <View style={styles.doneCard}>
          <Text style={styles.doneIcon}>✓</Text>
          <Text style={styles.doneTitle}>Attendance marked</Text>
          <Text style={styles.doneTime}>Today at {formatTimestamp(todayRecord.timestamp)}</Text>
          {todayRecord.gps_lat ? (
            <Text style={styles.doneGps}>Location recorded</Text>
          ) : null}
        </View>
        <View style={styles.doneHintCard}>
          <Text style={styles.doneHintText}>
            You have already marked attendance today. See you tomorrow.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.greetingName}>{worker?.name ?? 'Worker'}</Text>
        </View>
        <View style={styles.profileWrap}>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount} pending</Text>
            </View>
          )}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      {/* ── Camera ── */}
      <View style={styles.cameraFrame}>
        <CameraView ref={cameraRef} onInference={setLatestInference} runGestureCheck={challengeArmed && useRealGestures} />
        {/* Face / model status overlay */}
        <View style={styles.cameraOverlay}>
          <View style={[
            styles.statusDot,
            latestInference?.ready ? styles.dotGreen : styles.dotAmber,
          ]} />
          <Text style={styles.cameraStatus}>
            {!latestInference?.ready
              ? 'Starting camera…'
              : faceDetected
              ? 'Face detected'
              : 'Position your face in the frame'}
          </Text>
        </View>
      </View>

      {/* ── Challenge card ── */}
      <View style={styles.challengeCard}>
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
          <View style={[
            styles.challengeBadge,
            !challengeArmed ? styles.badgeIdle :
            challengeProgress.completed && challengeProgress.gestureDetected ? styles.badgeDone :
            challengeArmed && !challengeProgress.completed ? styles.badgeWatching :
            styles.badgeFail,
          ]}>
            <Text style={[
              styles.challengeBadgeText,
              !challengeArmed ? styles.badgeIdleText :
              challengeProgress.completed && challengeProgress.gestureDetected ? styles.badgeDoneText :
              challengeArmed && !challengeProgress.completed ? styles.badgeWatchingText :
              styles.badgeFailText,
            ]}>
              {!challengeArmed ? 'Waiting'
                : !challengeProgress.completed ? 'Watching…'
                : challengeProgress.gestureDetected ? '✓ Confirmed'
                : '✗ Try again'}
            </Text>
          </View>
        </View>
        <Text style={styles.challengeInstruction}>{challenge.instruction}</Text>
        {challengeProgress.detail !== getInitialChallengeProgress().detail && (
          <Text style={[
            styles.challengeDetail,
            challengeProgress.gestureDetected ? styles.challengeDetailGood : null,
          ]}>
            {challengeProgress.detail}
          </Text>
        )}
      </View>

      {/* ── Action button ── */}
      <TouchableOpacity
        style={[styles.verifyBtn, verifyDisabled && styles.verifyBtnDisabled]}
        onPress={handleVerify}
        disabled={verifyDisabled}
        activeOpacity={0.85}
      >
        {verifying ? (
          <ActivityIndicator color="#F5F5E8" />
        ) : (
          <Text style={styles.verifyBtnText}>
            {isLocked
              ? `Try again in ${lockSeconds}s`
              : !challengeArmed
              ? 'Start Verification'
              : !challengeProgress.completed
              ? 'Watching for gesture…'
              : !challengeProgress.gestureDetected
              ? 'Gesture not detected — retry'
              : waitingForModels
              ? 'Please wait…'
              : 'Mark Attendance'}
          </Text>
        )}
      </TouchableOpacity>

      {/* ── Warnings ── */}
      {failedAttempts > 0 && !isLocked && (
        <Text style={styles.warning}>
          {failedAttempts} failed attempt{failedAttempts === 1 ? '' : 's'} — {MAX_FAILED_ATTEMPTS - failedAttempts} remaining
        </Text>
      )}
      {!locGranted && (
        <Text style={styles.warning}>
          Location permission denied — GPS will not be recorded
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingTop: 52,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingBlock: { flex: 1, paddingRight: 12 },
  greeting: { color: C.textSecondary, fontSize: 13, fontWeight: FONT.medium, marginBottom: 1 },
  greetingName: { color: C.textPrimary, fontSize: 22, fontWeight: FONT.extraBold },
  profileWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    backgroundColor: C.warning,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: FONT.bold, color: '#FFFFFF' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: FONT.black },

  cameraFrame: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0A1628',
    borderRadius: RADIUS.xl,
    marginBottom: 14,
  },
  cameraOverlay: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: C.success },
  dotAmber: { backgroundColor: C.warning },
  cameraStatus: { color: '#FFFFFF', fontSize: 12, fontWeight: FONT.semiBold, flex: 1 },

  challengeCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 14,
    ...SHADOW.sm,
  },
  challengeHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  challengeTitle: { color: C.textPrimary, fontSize: 15, fontWeight: FONT.bold },
  challengeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeIdle:     { backgroundColor: C.primaryLight },
  badgePending:  { backgroundColor: C.primaryLight },
  badgeWatching: { backgroundColor: C.warningBg },
  badgeDone:     { backgroundColor: C.successBg },
  badgeFail:     { backgroundColor: C.errorBg },
  challengeBadgeText: { fontSize: 11, fontWeight: FONT.bold },
  badgeIdleText:     { color: C.textSecondary },
  badgePendingText:  { color: C.primary },
  badgeWatchingText: { color: C.warningText },
  badgeDoneText:     { color: C.successText },
  badgeFailText:     { color: C.errorText },
  challengeInstruction: { color: C.textSecondary, fontSize: 13, lineHeight: 19 },
  challengeDetail: { color: C.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 17 },
  challengeDetailGood: { color: C.successText },

  verifyBtn: {
    backgroundColor: C.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
    ...SHADOW.lg,
  },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: FONT.bold },

  warning: { fontSize: 12, color: C.warning, textAlign: 'center', marginBottom: 8, lineHeight: 17 },

  alertCard: {
    flex: 1,
    backgroundColor: C.warningBg,
    borderRadius: RADIUS.lg,
    padding: 28,
    alignItems: 'center', justifyContent: 'center',
    margin: 16,
    borderWidth: 1,
    borderColor: C.warning + '55',
  },
  alertCardIcon: { fontSize: 40, marginBottom: 14, color: C.warning },
  alertCardTitle: { color: C.warningText, fontSize: 18, fontWeight: FONT.extraBold, marginBottom: 8 },
  alertCardText: { color: C.warningText, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  doneCard: {
    flex: 1,
    backgroundColor: C.successBg,
    borderRadius: RADIUS.xl,
    padding: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.success + '44',
  },
  doneIcon: { fontSize: 56, color: C.success, marginBottom: 12 },
  doneTitle: { color: C.successText, fontSize: 22, fontWeight: FONT.extraBold, marginBottom: 6 },
  doneTime: { color: C.successText, fontSize: 16, fontWeight: FONT.semiBold, marginBottom: 4 },
  doneGps: { color: C.success, fontSize: 13 },
  doneHintCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  doneHintText: { color: C.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
