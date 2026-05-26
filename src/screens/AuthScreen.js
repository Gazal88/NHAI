import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, Dimensions, Platform
} from 'react-native';
import CameraView from '../components/CameraView';

const { width } = Dimensions.get('window');

export default function AuthScreen({ onSuccess, onEnroll }){
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EFE6" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>FA</Text>
          </View>
          <Text style={styles.appName}>FaceAuth</Text>
        </View>
        <View style={styles.offlinePill}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineLabel}>OFFLINE</Text>
        </View>
      </View>

      {/* CAMERA BOX */}
      <View style={styles.cameraCard}>
        <View style={styles.cameraInner}>
          <CameraView />
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
        </View>
        <View style={styles.cameraFooter}>
          <Text style={styles.cameraHint}>● SCANNING</Text>
          <Text style={styles.cameraHint}>ALIGN FACE TO FRAME</Text>
        </View>
      </View>

      {/* PROMPT */}
      <View style={styles.promptBox}>
        <Text style={styles.promptText}>Please blink naturally</Text>
      </View>

  {/* STATUS ROW */}
      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#A0522D' }]} />
          <Text style={styles.statusVal}>Liveness Check</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#7A9E7E' }]} />
          <Text style={styles.statusVal}>Face Match</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#C8A97E' }]} />
          <Text style={styles.statusVal}>3 Unsynced</Text>
        </View>
      </View>

     <TouchableOpacity style={styles.button} onPress={() => onSuccess('Field Worker')} activeOpacity={0.85}>
        <Text style={styles.buttonText}>VERIFY IDENTITY</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onEnroll} activeOpacity={0.85}>
        <Text style={styles.secondaryButtonText}>Enroll New Worker</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5EFE6',
    paddingHorizontal: 22,
    paddingTop: 52,
    paddingBottom: 28,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#A0522D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#F5EFE6',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  appName: {
    color: '#2C1A0E',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE0CC',
    borderWidth: 1,
    borderColor: '#C8A97E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A0522D',
  },
  offlineLabel: {
    color: '#A0522D',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  cameraCard: {
    width: '100%',
    backgroundColor: '#EDE0CC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D4C4A8',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#A0522D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cameraInner: {
    width: '100%',
    height: width - 60,
    backgroundColor: '#D4C4A8',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#A0522D',
    zIndex: 10,
  },
  cTL: {
    top: 12, left: 12,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderTopLeftRadius: 6,
  },
  cTR: {
    top: 12, right: 12,
    borderTopWidth: 2, borderRightWidth: 2,
    borderTopRightRadius: 6,
  },
  cBL: {
    bottom: 12, left: 12,
    borderBottomWidth: 2, borderLeftWidth: 2,
    borderBottomLeftRadius: 6,
  },
  cBR: {
    bottom: 12, right: 12,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderBottomRightRadius: 6,
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cameraHint: {
    color: '#A0522D',
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  promptBox: {
    width: '100%',
    backgroundColor: '#EDE0CC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4C4A8',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 14,
    shadowColor: '#A0522D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  promptText: {
    color: '#2C1A0E',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  statusRow: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#EDE0CC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4C4A8',
    paddingVertical: 14,
    paddingHorizontal: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  statusItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusVal: {
    color: '#2C1A0E',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#D4C4A8',
  },
  button: {
    width: '100%',
    backgroundColor: '#A0522D',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#A0522D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: {
    color: '#F5EFE6',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  footer: {
    color: '#C8A97E',
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4C4A8',
  },
  secondaryButtonText: {
    color: '#A0522D',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  }
});