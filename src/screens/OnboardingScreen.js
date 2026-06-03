import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Animated, ScrollView, ImageBackground,
} from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../theme';

let bgLaunch = null;
try { bgLaunch = require('../../assets/images/bg_launch.png'); } catch (_) {}

const ADMIN_PIN = 'ADMIN1234';
const FLIP_DURATION = 420;

export default function OnboardingScreen({ lookupWorker, onComplete, onAdminLogin }) {
  const [isAdmin, setIsAdmin]       = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [passcode, setPasscode]     = useState('');
  const [adminPin, setAdminPin]     = useState('');
  const [loading, setLoading]       = useState(false);

  // The flip value goes 0 → 180 (worker→admin) and back
  const flipAnim = useRef(new Animated.Value(0)).current;
  // Track whether we've crossed the midpoint to swap face visibility
  const [showAdmin, setShowAdmin]   = useState(false);

  // Background color transition (0 = worker blue, 1 = admin indigo)
  const bgAnim = useRef(new Animated.Value(0)).current;

  // Card entrance on mount
  const mountScale   = useRef(new Animated.Value(0.92)).current;
  const mountOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(mountScale, { toValue: 1, tension: 65, friction: 9, useNativeDriver: true }),
      Animated.timing(mountOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  const doFlip = (toAdmin) => {
    if (toAdmin === isAdmin) return;

    const toValue = toAdmin ? 180 : 0;

    // Start background color transition
    Animated.timing(bgAnim, {
      toValue: toAdmin ? 1 : 0,
      duration: FLIP_DURATION,
      useNativeDriver: false,
    }).start();

    // At the midpoint of the flip (half rotation), swap which face is shown
    setTimeout(() => {
      setShowAdmin(toAdmin);
    }, FLIP_DURATION / 2);

    // Run the flip
    Animated.timing(flipAnim, {
      toValue,
      duration: FLIP_DURATION,
      useNativeDriver: true,
    }).start(() => {
      setIsAdmin(toAdmin);
    });
  };

  // Front face (Worker) rotates 0→90 (disappears), back face (Admin) rotates -90→0 (appears)
  const frontRotate = flipAnim.interpolate({
    inputRange:  [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange:  [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const bgColor = bgAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [C.bg, C.adminLight],
  });
  const headerBg = bgAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [C.primary, C.adminPrimary],
  });

  const handleWorkerLogin = async () => {
    const id = employeeId.trim(), code = passcode.trim();
    if (!id || !code) { Alert.alert('Required', 'Enter Employee ID and passcode.'); return; }
    setLoading(true);
    try {
      const worker = await lookupWorker(id);
      if (!worker) { Alert.alert('Not Found', `Employee ID "${id}" not found.`); return; }
      if ((worker.passcode ?? '') !== code) { Alert.alert('Access Denied', 'Incorrect passcode.'); return; }
      onComplete(worker);
    } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleAdminLogin = () => {
    if (adminPin.trim() !== ADMIN_PIN) {
      Alert.alert('Access Denied', 'Incorrect admin PIN.');
      setAdminPin('');
      return;
    }
    onAdminLogin();
  };

  return (
    <Animated.View style={[styles.root, { backgroundColor: bgColor }]}>
      {/* bg_launch as subtle watermark */}
      {bgLaunch && (
        <ImageBackground
          source={bgLaunch}
          style={styles.bgWatermark}
          resizeMode="cover"
          imageStyle={{ opacity: 0.07 }}
        />
      )}
      {/* Header band with hero image */}
      <Animated.View style={[styles.header, { backgroundColor: headerBg }]}>
        {/* Hero image overlay */}
        <View style={styles.heroImageWrap}>
          {(() => {
            try {
              const img = require('../../assets/images/hero_login.png');
              const { Image } = require('react-native');
              return <Image source={img} style={styles.heroImage} resizeMode="cover" />;
            } catch (_) { return null; }
          })()}
          <View style={styles.heroOverlay} />
        </View>
        <Text style={styles.headerApp}>Pehchaan</Text>
        <Text style={styles.headerSub}>पहचान  ·  Field Attendance System</Text>
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Hero image strip — fills the empty space behind the card */}
        {bgLaunch && (
          <ImageBackground
            source={bgLaunch}
            style={styles.heroStrip}
            resizeMode="cover"
          >
            <View style={styles.heroStripOverlay} />
          </ImageBackground>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Toggle buttons — above the card, always visible */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !isAdmin && styles.toggleBtnWorker]}
            onPress={() => doFlip(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleBtnText, !isAdmin && styles.toggleBtnTextActive]}>
              Worker
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isAdmin && styles.toggleBtnAdmin]}
            onPress={() => doFlip(true)}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleBtnText, isAdmin && styles.toggleBtnTextActive]}>
              Admin
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3D flip card container */}
        <Animated.View style={[styles.cardContainer, { opacity: mountOpacity, transform: [{ scale: mountScale }] }]}>

          {/* FRONT FACE — Worker */}
          <Animated.View style={[
            styles.card,
            styles.cardFace,
            { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] },
            showAdmin && styles.hidden,
          ]}>
            <View style={styles.faceIndicator}>
              <View style={styles.faceIndicatorDot} />
              <Text style={styles.faceIndicatorText}>Worker Login</Text>
            </View>

            <Text style={styles.title}  >Welcome back</Text>
            <Text style={styles.subtitle}>Enter your Employee ID and passcode to mark attendance.</Text>

            <Text style={styles.label}>EMPLOYEE ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. EMP001"
              placeholderTextColor={C.textMuted}
              value={employeeId}
              onChangeText={setEmployeeId}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
            />
            <Text style={styles.label}>PASSCODE</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter passcode"
              placeholderTextColor={C.textMuted}
              value={passcode}
              onChangeText={setPasscode}
              secureTextEntry
              keyboardType="number-pad"
              editable={!loading}
              onSubmitEditing={handleWorkerLogin}
            />
            <TouchableOpacity
              style={[styles.btn, styles.btnWorker, loading && styles.btnDisabled]}
              onPress={handleWorkerLogin}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.btnText}>Login</Text>}
            </TouchableOpacity>

            <Text style={styles.footerNote}>Contact your site admin if you cannot log in.</Text>
          </Animated.View>

          {/* BACK FACE — Admin */}
          <Animated.View style={[
            styles.card,
            styles.cardFace,
            styles.cardBack,
            { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
            !showAdmin && styles.hidden,
          ]}>
            <View style={[styles.faceIndicator, styles.faceIndicatorAdmin]}>
              <View style={[styles.faceIndicatorDot, styles.faceIndicatorDotAdmin]} />
              <Text style={[styles.faceIndicatorText, { color: C.adminPrimary }]}>Admin Access</Text>
            </View>

            <Text style={[styles.title, styles.titleAdmin]}>Admin Panel</Text>
            <Text style={styles.subtitle}>Authorised personnel only. Enter your admin PIN to continue.</Text>

            <Text style={styles.label}>ADMIN PIN</Text>
            <TextInput
              style={[styles.input, styles.inputAdmin]}
              placeholder="Enter admin PIN"
              placeholderTextColor={C.textMuted}
              value={adminPin}
              onChangeText={setAdminPin}
              secureTextEntry
              autoCorrect={false}
              onSubmitEditing={handleAdminLogin}
            />
            <TouchableOpacity
              style={[styles.btn, styles.btnAdmin]}
              onPress={handleAdminLogin}
              activeOpacity={0.88}
            >
              <Text style={styles.btnText}>Open Admin Panel</Text>
            </TouchableOpacity>

            <Text style={styles.footerNote}>Admin access is restricted to authorised NHAI personnel.</Text>
          </Animated.View>

        </Animated.View>

        {/* <Text style={styles.version}>NHAI Field Attendance  ·  Pehchaan v1.0</Text> */}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bgWatermark: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 0,
  },

  header: {
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImageWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,33,71,0.72)',
  },
  headerApp: {
    fontSize: 28,
    fontWeight: FONT.black,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 4,
    zIndex: 1,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: FONT.medium,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.3,
    zIndex: 1,
  },
  nhaiBadge: {
    position: 'absolute',
    top: 54,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
  },
  nhaiBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: FONT.black,
    letterSpacing: 1,
  },
  nhaiBadgeSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: FONT.medium,
    letterSpacing: 0.5,
  },

  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    position: 'relative',
  },
  heroStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  heroStripOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,10,30,0.55)',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 32,
    zIndex: 1,
  },

  // Toggle row above card
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: RADIUS.full,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  toggleBtnWorker: {
    backgroundColor: C.primary,
    ...SHADOW.sm,
  },
  toggleBtnAdmin: {
    backgroundColor: C.adminPrimary,
    ...SHADOW.sm,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: FONT.semiBold,
    color: C.textSecondary,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: FONT.bold,
  },

  // Card flip container — must have fixed height
  cardContainer: {
    position: 'relative',
    minHeight: 360,
  },

  // Both faces share this base
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backfaceVisibility: 'hidden',
  },

  hidden: {
    // Prevent interaction on the hidden face
    pointerEvents: 'none',
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.xl,
    padding: 24,
    ...SHADOW.md,
  },
  cardBack: {
    backgroundColor: '#F4F7FB', // slightly different tint for admin
  },

  // Face indicator strip
  faceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  faceIndicatorAdmin: {
    borderBottomColor: C.adminPrimary + '22',
  },
  faceIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  faceIndicatorDotAdmin: {
    backgroundColor: C.adminPrimary,
  },
  faceIndicatorText: {
    fontSize: 11,
    fontWeight: FONT.bold,
    color: C.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  title: {
    fontSize: 22,
    fontWeight: FONT.extraBold,
    color: C.textPrimary,
    marginBottom: 6,
  },
  titleAdmin: { color: C.adminPrimary },
  subtitle: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
    marginBottom: 20,
  },

  label: {
    fontSize: 11,
    fontWeight: FONT.bold,
    color: C.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: FONT.medium,
    color: C.textPrimary,
    marginBottom: 16,
  },
  inputAdmin: {
    borderColor: C.adminPrimary + '44',
  },

  btn: {
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
    ...SHADOW.lg,
  },
  btnWorker: { backgroundColor: C.primary },
  btnAdmin:  { backgroundColor: C.adminPrimary },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontSize: 15,
    fontWeight: FONT.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  footerNote: {
    fontSize: 11,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  version: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
