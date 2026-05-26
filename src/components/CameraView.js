import { StyleSheet, View, Text } from 'react-native';

export default function CameraView() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.icon}>◉</Text>
      <Text style={styles.text}>INITIALISING SENSOR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4C4A8',
  },
  icon: {
    fontSize: 36,
    color: '#A0522D',
    marginBottom: 10,
  },
  text: {
    color: '#A0522D',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
});