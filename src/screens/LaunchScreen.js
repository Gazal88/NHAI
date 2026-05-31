import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function LaunchScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <Text style={styles.markText}>FA</Text>
      </View>
      <Text style={styles.title}>FaceAuth</Text>
      <Text style={styles.subtitle}>Offline field attendance module</Text>
      <ActivityIndicator size="small" color="#5C6B3A" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  mark: {
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: '#5C6B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  markText: {
    color: '#F5F5E8',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: '#2C3520',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: '#7A8A6A',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  loader: {
    marginTop: 28,
  },
});
