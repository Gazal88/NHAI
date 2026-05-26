import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, Platform
} from 'react-native';

export default function SuccessScreen({ workerName = 'Rajesh Kumar', onDone }) {
  const time = new Date().toLocaleTimeString();
  const date = new Date().toLocaleDateString();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EFE6" />

      <View style={styles.iconCircle}>
        <Text style={styles.icon}>✓</Text>
      </View>

      <Text style={styles.heading}>Verified</Text>
      <Text style={styles.subheading}>Identity confirmed successfully</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{workerName}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.row}>
          <Text style={styles.label}>Time</Text>
          <Text style={styles.value}>{time}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{date}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.row}>
          <Text style={styles.label}>Confidence</Text>
          <Text style={[styles.value, { color: '#7A9E7E' }]}>97.4%</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>Logged Offline</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={onDone} activeOpacity={0.85}>
        <Text style={styles.buttonText}>DONE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5EFE6',
    paddingHorizontal: 22,
    paddingTop: 80,
    paddingBottom: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7A9E7E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    color: '#F5EFE6',
    fontSize: 36,
    fontWeight: '900',
  },
  heading: {
    color: '#2C1A0E',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    marginBottom: 6,
  },
  subheading: {
    color: '#A0522D',
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 32,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  card: {
    width: '100%',
    backgroundColor: '#EDE0CC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4C4A8',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 28,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  sep: {
    height: 1,
    backgroundColor: '#D4C4A8',
  },
  label: {
    color: '#A0522D',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  value: {
    color: '#2C1A0E',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  button: {
    width: '100%',
    backgroundColor: '#A0522D',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 4,
  },
  buttonText: {
    color: '#F5EFE6',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
});