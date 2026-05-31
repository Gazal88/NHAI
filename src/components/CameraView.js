import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';

const RECOGNITION_THRESHOLD = 0.82;

function useNativeCameraModules() {
  return useMemo(() => {
    try {
      const visionCamera = require('react-native-vision-camera');
      const tflite = require('react-native-fast-tflite');
      const { NitroModules } = require('react-native-nitro-modules');
      const { useResizePlugin } = require('vision-camera-resize-plugin');
      const { Worklets } = require('react-native-worklets-core');

      return {
        ...visionCamera,
        useTensorflowModel: tflite.useTensorflowModel,
        NitroModules,
        useResizePlugin,
        Worklets,
      };
    } catch (error) {
      console.log('Camera inference unavailable:', error.message);
      return null;
    }
  }, []);
}

const CameraView = forwardRef(function CameraView({ onInference }, ref) {
  const cameraModules = useNativeCameraModules();

  if (!cameraModules) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.icon}>CAM</Text>
        <Text style={styles.text}>CAMERA MODULE NOT READY</Text>
        <Text style={styles.subText}>Rebuild the Android app after native camera changes.</Text>
      </View>
    );
  }

  return (
    <CameraPreview
      ref={ref}
      cameraModules={cameraModules}
      onInference={onInference}
    />
  );
});

export default CameraView;

const getTensorSpec = (model, fallback) => {
  const input = model?.inputs?.[0];
  const shape = input?.shape ?? [];
  const dataType = input?.dataType === 'float32' ? 'float32' : 'uint8';
  const channelCount = shape[shape.length - 1] === 4 ? 4 : 3;
  const width = shape.length >= 3 ? shape[shape.length - 2] : fallback.width;
  const height = shape.length >= 3 ? shape[shape.length - 3] : fallback.height;

  return {
    width: width > 0 ? width : fallback.width,
    height: height > 0 ? height : fallback.height,
    dataType,
    pixelFormat: channelCount === 4 ? 'rgba' : 'rgb',
    outputType: model?.outputs?.[0]?.dataType ?? 'float32',
  };
};

const sliceBuffer = (array) => {
  'worklet';
  return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
};

const firstValue = (buffer, dataType) => {
  'worklet';
  if (buffer == null) return null;
  if (dataType === 'uint8') {
    const values = new Uint8Array(buffer);
    return values.length > 0 ? values[0] / 255 : null;
  }
  if (dataType === 'int8') {
    const values = new Int8Array(buffer);
    return values.length > 0 ? (values[0] + 128) / 255 : null;
  }
  const values = new Float32Array(buffer);
  return values.length > 0 ? values[0] : null;
};

const bufferToNumberArray = (buffer, dataType, maxLength) => {
  'worklet';
  if (buffer == null) return [];
  let values;
  if (dataType === 'uint8') {
    values = new Uint8Array(buffer);
  } else if (dataType === 'int8') {
    values = new Int8Array(buffer);
  } else {
    values = new Float32Array(buffer);
  }
  const length = maxLength && maxLength < values.length ? maxLength : values.length;
  const result = [];
  for (let i = 0; i < length; i += 1) {
    result.push(values[i]);
  }
  return result;
};

const CameraPreview = forwardRef(function CameraPreview({ cameraModules, onInference }, ref) {
  const {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useFrameProcessor,
    useTensorflowModel,
    NitroModules,
    useResizePlugin,
    Worklets,
  } = cameraModules;
  const cameraRef = useRef(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const { resize } = useResizePlugin();
  const livenessPlugin = useTensorflowModel(require('../../assets/models/liveness.tflite'), []);
  const recognitionPlugin = useTensorflowModel(require('../../assets/models/mobilefacenet.tflite'), []);
  const livenessModel = livenessPlugin.state === 'loaded' ? livenessPlugin.model : null;
  const recognitionModel = recognitionPlugin.state === 'loaded' ? recognitionPlugin.model : null;
  const boxedLivenessModel = useMemo(
    () => (livenessModel ? NitroModules.box(livenessModel) : null),
    [NitroModules, livenessModel]
  );
  const boxedRecognitionModel = useMemo(
    () => (recognitionModel ? NitroModules.box(recognitionModel) : null),
    [NitroModules, recognitionModel]
  );
  const livenessSpec = useMemo(
    () => getTensorSpec(livenessModel, { width: 224, height: 224 }),
    [livenessModel]
  );
  const recognitionSpec = useMemo(
    () => getTensorSpec(recognitionModel, { width: 112, height: 112 }),
    [recognitionModel]
  );
  const reportInference = useMemo(
    () => Worklets.createRunOnJS((result) => onInference?.(result)),
    [Worklets, onInference]
  );
  const lastReportAt = useMemo(
    () => Worklets.createSharedValue(0),
    [Worklets]
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (boxedLivenessModel == null || boxedRecognitionModel == null) return;

      const now = Date.now();
      if (now - lastReportAt.value < 750) return;
      lastReportAt.value = now;

      const liveness = boxedLivenessModel.unbox();
      const recognition = boxedRecognitionModel.unbox();

      try {
        const livenessInput = resize(frame, {
          scale: {
            width: livenessSpec.width,
            height: livenessSpec.height,
          },
          pixelFormat: livenessSpec.pixelFormat,
          dataType: livenessSpec.dataType,
        });
        const recognitionInput = resize(frame, {
          scale: {
            width: recognitionSpec.width,
            height: recognitionSpec.height,
          },
          pixelFormat: recognitionSpec.pixelFormat,
          dataType: recognitionSpec.dataType,
        });

        const livenessOutput = liveness.runSync([sliceBuffer(livenessInput)]);
        const recognitionOutput = recognition.runSync([sliceBuffer(recognitionInput)]);
        const livenessScore = firstValue(livenessOutput[0], livenessSpec.outputType);
        const embedding = bufferToNumberArray(
          recognitionOutput[0],
          recognitionSpec.outputType,
          512
        );

        reportInference({
          ready: true,
          timestamp: Date.now(),
          livenessScore,
          embedding,
          recognitionThreshold: RECOGNITION_THRESHOLD,
        });
      } catch (error) {
        reportInference({
          ready: false,
          timestamp: Date.now(),
          error: String(error?.message ?? error),
        });
      }
    },
    [
      boxedLivenessModel,
      boxedRecognitionModel,
      livenessSpec,
      lastReportAt,
      recognitionSpec,
      reportInference,
      resize,
    ]
  );

  useImperativeHandle(ref, () => ({
    async capturePhoto() {
      if (!cameraRef.current) {
        throw new Error('Camera is not ready yet.');
      }

      return cameraRef.current.takePhoto({
        flash: 'off',
      });
    },
  }));

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.icon}>CAM</Text>
        <Text style={styles.text}>REQUESTING PERMISSION</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.icon}>CAM</Text>
        <Text style={styles.text}>NO FRONT CAMERA</Text>
        <Text style={styles.subText}>Set emulator front camera to Webcam0 or VirtualScene.</Text>
      </View>
    );
  }

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
      photo={true}
      video={false}
      audio={false}
      frameProcessor={frameProcessor}
      onError={(error) => console.log('Camera error:', error)}
    />
  );
});

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0E8',
    paddingHorizontal: 20,
  },
  icon: {
    fontSize: 16,
    color: '#5C6B3A',
    fontWeight: '900',
    marginBottom: 10,
  },
  text: {
    color: '#5C6B3A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subText: {
    color: '#7A8A6A',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 8,
  },
});
