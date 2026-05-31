import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, Platform
} from 'react-native';

export default function SuccessScreen({ workerName = 'Field Worker', onDone }) {
  const time = new Date().toLocaleTimeString();
  const date = new Date().toLocaleDateString();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5E8" />

      <View style={styles.iconCircle}>
        <Text style={styles.icon}>✓</Text>
      </View>

      <Text style={styles.heading}>Verified</Text>
      <Text style={styles.subheading}>Identity confirmed successfully</Text>

      <View style={styles.card}>
        {[
          { label: 'NAME', value: workerName },
          { label: 'TIME', value: time },
          { label: 'DATE', value: date },
          { label: 'CONFIDENCE', value: '97.4%', green: true },
          { label: 'STATUS', value: 'Logged Offline' },
        ].map((row, i, arr) => (
          <View key={row.label}>
            <View style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={[styles.value, row.green && { color: '#5C6B3A' }]}>
                {row.value}
              </Text>
            </View>
            {i < arr.length - 1 && <View style={styles.sep} />}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={onDone} activeOpacity={0.85}>
        <Text style={styles.buttonText}>DONE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#F5F5E8',
    paddingHorizontal: 20, paddingTop: 80,
    paddingBottom: 28, alignItems: 'center',
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#5C6B3A', alignItems: 'center',
    justifyContent: 'center', marginBottom: 20,
    elevation: 6, shadowColor: '#5C6B3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12,
  },
  icon: { color: '#F5F5E8', fontSize: 36, fontWeight: '900' },
  heading: {
    color: '#2C3520', fontSize: 32, fontWeight: '800',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    marginBottom: 6,
  },
  subheading: {
    color: '#7A8A6A', fontSize: 13, letterSpacing: 0.5,
    marginBottom: 32,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  card: {
    width: '100%', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 20,
    paddingVertical: 8, marginBottom: 28,
    elevation: 3, shadowColor: '#5C6B3A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 14,
  },
  sep: { height: 1, backgroundColor: '#EEF0E8' },
  label: {
    color: '#A8B5A0', fontSize: 10, letterSpacing: 1.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  value: { color: '#2C3520', fontSize: 14, fontWeight: '700' },
  button: {
    width: '100%', backgroundColor: '#5C6B3A',
    paddingVertical: 17, borderRadius: 14,
    alignItems: 'center', elevation: 6,
    shadowColor: '#5C6B3A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12,
  },
  buttonText: {
    color: '#F5F5E8', fontSize: 14, fontWeight: '900',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
});