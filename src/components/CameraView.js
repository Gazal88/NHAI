import { StyleSheet, View, Text } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

export default function CameraView() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  if (!hasPermission) {
    requestPermission();
    return (
      <View style={styles.placeholder}>
        <Text style={styles.text}>REQUESTING PERMISSION</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.text}>NO CAMERA FOUND</Text>
      </View>
    );
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4C4A8',
  },
  text: {
    color: '#A0522D',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
});