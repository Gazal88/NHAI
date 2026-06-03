import { useEffect, useRef } from 'react';
import { Animated, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { C, FONT, SHADOW } from '../theme';

let bgLaunch = null;
try { bgLaunch = require('../../assets/images/bg_launch.png'); } catch (_) {}

export default function LaunchScreen({ hint }) {
  // Entrance animations
  const logoScale   = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(20)).current;
  const dotOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo pops in first
    Animated.spring(logoScale, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Text slides up after logo
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(textY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, 300);

    // Dot pulses in last
    setTimeout(() => {
      Animated.timing(dotOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 600);
  }, []);

  const Wrapper = bgLaunch ? ImageBackground : View;
  const wrapperProps = bgLaunch
    ? { source: bgLaunch, style: styles.container, resizeMode: 'cover' }
    : { style: styles.container };

  return (
    <Wrapper {...wrapperProps}>
      {/* Dark overlay when background image is present */}
      {bgLaunch && <View style={styles.overlay} />}
      {/* Background accent circles */}
      <View style={styles.circleLarge} />
      <View style={styles.circleSmall} />

      {/* Logo mark */}
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoMark}>
          <Text style={styles.logoP}>P</Text>
        </View>
        <Animated.View style={[styles.logoDot, { opacity: dotOpacity }]} />
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View style={{ alignItems: 'center', opacity: textOpacity, transform: [{ translateY: textY }] }}>
        <Text style={styles.appName}>Pehchaan</Text>
        <Text style={styles.taglineHindi}>पहचान</Text>
        <Text style={styles.tagline}>Identity · Presence · Trust</Text>
      </Animated.View>

      {/* Loading dots — no text hint shown to user */}
      <Animated.View style={[styles.dotsRow, { opacity: textOpacity }]}>
        <LoadingDots />
      </Animated.View>

      {/* Bottom branding */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerText}>National Highways Authority of India</Text>
        <Text style={styles.footerSub}>NHAI · Datalake 3.0</Text>
      </View>
    </Wrapper>
  );
}

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (val, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay(800),
        ])
      ).start();
    };
    pulse(dot1, 0);
    pulse(dot2, 200);
    pulse(dot3, 400);
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 28 }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,33,71,0.82)',
  },

  // Background accent circles (decorative)
  circleLarge: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.03)',
    top: -80,
    right: -100,
  },
  circleSmall: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: 120,
    left: -60,
  },

  logoWrap: { alignItems: 'center', marginBottom: 28 },
  logoMark: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.lg,
  },
  logoP: {
    fontSize: 48,
    fontWeight: FONT.black,
    color: C.primary,
    lineHeight: 56,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accent,
    marginTop: 10,
  },

  appName: {
    fontSize: 40,
    fontWeight: FONT.black,
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 4,
  },
  taglineHindi: {
    fontSize: 18,
    fontWeight: FONT.bold,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 12,
    fontWeight: FONT.medium,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  dotsRow: { alignItems: 'center' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },

  hint: {
    marginTop: 16,
    fontSize: 11,
    fontWeight: FONT.medium,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },

  footer: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  footerDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  footerText: {
    fontSize: 11,
    fontWeight: FONT.semiBold,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footerSub: {
    fontSize: 10,
    fontWeight: FONT.regular,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 3,
    letterSpacing: 1,
  },
});
