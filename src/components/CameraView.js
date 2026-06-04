import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────
const RECOGNITION_THRESHOLD = 0.75;

const BLAZEFACE_INPUT_SIZE = 128;
const BLAZEFACE_ANCHORS_COUNT = 896;
const BLAZEFACE_SCORE_THRESHOLD = 0.35;

const BLAZEFACE_TICK_MS = 250;  // face detection: every 250ms
const INFERENCE_TICK_MS = 350;  // liveness + embedding: every 350ms

// ─── BlazeFace anchor generation ──────────────────────────────────────────
function generateBlazeFaceAnchors() {
  const anchors = [];
  const strides = [8, 16, 16, 16];
  for (let s = 0; s < strides.length; s++) {
    const gridSize = Math.ceil(BLAZEFACE_INPUT_SIZE / strides[s]);
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        anchors.push((x + 0.5) / gridSize, (y + 0.5) / gridSize);
        anchors.push((x + 0.5) / gridSize, (y + 0.5) / gridSize);
      }
    }
  }
  return anchors;
}

// ─── Worklet helpers ───────────────────────────────────────────────────────
/** Applies sigmoid to convert raw logits to probabilities. */
const sigmoid = (x) => {
  'worklet';
  if (x >= 0) {
    return 1.0 / (1.0 + Math.exp(-x));
  }
  // Numerically stable version for negative values
  const e = Math.exp(x);
  return e / (1.0 + e);
};
const sliceBuffer = (array) => {
  'worklet';
  return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
};

const firstValue = (buffer, dataType) => {
  'worklet';
  if (buffer == null) return null;
  if (dataType === 'uint8') {
    const v = new Uint8Array(buffer);
    return v.length > 0 ? v[0] / 255 : null;
  }
  if (dataType === 'int8') {
    const v = new Int8Array(buffer);
    return v.length > 0 ? (v[0] + 128) / 255 : null;
  }
  const v = new Float32Array(buffer);
  return v.length > 0 ? v[0] : null;
};

const bufferToNumberArray = (buffer, dataType, maxLength) => {
  'worklet';
  if (buffer == null) return [];
  let values;
  if (dataType === 'uint8') values = new Uint8Array(buffer);
  else if (dataType === 'int8') values = new Int8Array(buffer);
  else values = new Float32Array(buffer);
  const len = maxLength && maxLength < values.length ? maxLength : values.length;
  const result = [];
  for (let i = 0; i < len; i++) result.push(values[i]);
  return result;
};

// Parse BlazeFace output — only used for faceDetected indicator
const parseBlazeface = (scoresBuffer, boxesBuffer, anchors) => {
  'worklet';
  if (!scoresBuffer || !boxesBuffer) return null;
  const scores = new Float32Array(scoresBuffer);
  const boxes  = new Float32Array(boxesBuffer);
  let bestScore = BLAZEFACE_SCORE_THRESHOLD;
  let bestIdx   = -1;
  for (let i = 0; i < BLAZEFACE_ANCHORS_COUNT; i++) {
    if (scores[i] > bestScore) { bestScore = scores[i]; bestIdx = i; }
  }
  if (bestIdx === -1) return null;
  const anchorCx = anchors[bestIdx * 2];
  const anchorCy = anchors[bestIdx * 2 + 1];
  const off = bestIdx * 16;
  return {
    cx: anchorCx + boxes[off + 1] / BLAZEFACE_INPUT_SIZE,
    cy: anchorCy + boxes[off + 0] / BLAZEFACE_INPUT_SIZE,
    w:  boxes[off + 3] / BLAZEFACE_INPUT_SIZE,
    h:  boxes[off + 2] / BLAZEFACE_INPUT_SIZE,
  };
};

// ─── Tensor spec helper ────────────────────────────────────────────────────
const getTensorSpec = (model, fallback) => {
  const input = model?.inputs?.[0];
  const shape = input?.shape ?? [];
  const dataType = input?.dataType === 'float32' ? 'float32' : 'uint8';
  const channelCount = shape[shape.length - 1] === 4 ? 4 : 3;
  const width  = shape.length >= 3 ? shape[shape.length - 2] : fallback.width;
  const height = shape.length >= 3 ? shape[shape.length - 3] : fallback.height;
  return {
    width:       width  > 0 ? width  : fallback.width,
    height:      height > 0 ? height : fallback.height,
    dataType,
    pixelFormat: channelCount === 4 ? 'rgba' : 'rgb',
    outputType:  model?.outputs?.[0]?.dataType ?? 'float32',
  };
};

// ─── Lazy native module loader ─────────────────────────────────────────────
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
      console.log('[CameraView] Native modules unavailable:', error.message);
      return null;
    }
  }, []);
}

// ─── Public component ──────────────────────────────────────────────────────
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

  return <CameraPreview ref={ref} cameraModules={cameraModules} onInference={onInference} />;
});

export default CameraView;

// ─── CameraPreview (inner) ─────────────────────────────────────────────────
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

  // Core models — liveness + recognition always loaded
  // useAssetManager: true is required for release APK builds on Android
  const livenessPlugin    = useTensorflowModel(require('../../assets/models/liveness.tflite'), [{ useAssetManager: true }]);
  const recognitionPlugin = useTensorflowModel(require('../../assets/models/mobilefacenet.tflite'), [{ useAssetManager: true }]);
  // BlazeFace — optional, only used for faceDetected indicator
  const blazefacePlugin   = useTensorflowModel(require('../../assets/models/blazeface.tflite'), [{ useAssetManager: true }]);

  const livenessModel    = livenessPlugin.state    === 'loaded' ? livenessPlugin.model    : null;
  const recognitionModel = recognitionPlugin.state === 'loaded' ? recognitionPlugin.model : null;
  const blazefaceModel   = blazefacePlugin.state   === 'loaded' ? blazefacePlugin.model   : null;

  const boxedLiveness    = useMemo(() => livenessModel    ? NitroModules.box(livenessModel)    : null, [NitroModules, livenessModel]);
  const boxedRecognition = useMemo(() => recognitionModel ? NitroModules.box(recognitionModel) : null, [NitroModules, recognitionModel]);
  const boxedBlazeface   = useMemo(() => blazefaceModel   ? NitroModules.box(blazefaceModel)   : null, [NitroModules, blazefaceModel]);

  const livenessSpec    = useMemo(() => getTensorSpec(livenessModel,    { width: 224, height: 224 }), [livenessModel]);
  const recognitionSpec = useMemo(() => getTensorSpec(recognitionModel, { width: 112, height: 112 }), [recognitionModel]);

  const blazefaceAnchors = useMemo(() => Worklets.createSharedValue(generateBlazeFaceAnchors()), [Worklets]);
  const reportInference  = useMemo(() => Worklets.createRunOnJS((r) => onInference?.(r)), [Worklets, onInference]);
  const lastBlazefaceAt  = useMemo(() => Worklets.createSharedValue(0), [Worklets]);
  const lastInferenceAt  = useMemo(() => Worklets.createSharedValue(0), [Worklets]);
  // Shared face-detected flag — updated by BlazeFace tick, read by inference tick
  const faceDetectedFlag = useMemo(() => Worklets.createSharedValue(false), [Worklets]);

  useEffect(() => {
    if (livenessPlugin.state !== 'loaded' || recognitionPlugin.state !== 'loaded') {
      onInference?.({ ready: false, timestamp: Date.now(), error: null });
    }
  }, [livenessPlugin.state, recognitionPlugin.state, onInference]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (boxedLiveness == null || boxedRecognition == null) return;

      const now = Date.now();

      // ── Tick A: BlazeFace — fast, runs every 250ms ─────────────────────
      // Only updates faceDetectedFlag. Does NOT affect liveness/recognition input.
      if (boxedBlazeface != null && now - lastBlazefaceAt.value >= BLAZEFACE_TICK_MS) {
        lastBlazefaceAt.value = now;
        try {
          const bf = boxedBlazeface.unbox();
          const bfInput = resize(frame, {
            scale: { width: BLAZEFACE_INPUT_SIZE, height: BLAZEFACE_INPUT_SIZE },
            pixelFormat: 'rgb',
            dataType: 'float32',
          });
          const bfOut = bf.runSync([sliceBuffer(bfInput)]);
          faceDetectedFlag.value = parseBlazeface(bfOut[0], bfOut[1], blazefaceAnchors.value) !== null;
        } catch (_) {
          // BlazeFace failed this tick — keep last known value
        }
      }

      // ── Tick B: Liveness + Recognition — every 600ms ───────────────────
      if (now - lastInferenceAt.value < INFERENCE_TICK_MS) return;
      lastInferenceAt.value = now;

      try {
        const liveness    = boxedLiveness.unbox();
        const recognition = boxedRecognition.unbox();

        // Full frame resize — no crop
        const livenessInput = resize(frame, {
          scale:       { width: livenessSpec.width, height: livenessSpec.height },
          pixelFormat: livenessSpec.pixelFormat,
          dataType:    livenessSpec.dataType,
        });
        const livenessOutput = liveness.runSync([sliceBuffer(livenessInput)]);
        // Apply sigmoid to convert raw logit to probability [0,1]
        const rawLogit = firstValue(livenessOutput[0], livenessSpec.outputType);
        const livenessScore = rawLogit == null ? null : sigmoid(rawLogit);

        const recognitionInput = resize(frame, {
          scale:       { width: recognitionSpec.width, height: recognitionSpec.height },
          pixelFormat: recognitionSpec.pixelFormat,
          dataType:    recognitionSpec.dataType,
        });
        const recognitionOutput = recognition.runSync([sliceBuffer(recognitionInput)]);
        const embedding = bufferToNumberArray(recognitionOutput[0], recognitionSpec.outputType, 512);

        reportInference({
          ready:                true,
          timestamp:            now,
          livenessScore,
          embedding,
          recognitionThreshold: RECOGNITION_THRESHOLD,
          faceDetected:         faceDetectedFlag.value,
        });
      } catch (error) {
        reportInference({
          ready:     false,
          timestamp: Date.now(),
          error:     String(error?.message ?? error),
        });
      }
    },
    [
      boxedLiveness, boxedRecognition, boxedBlazeface,
      blazefaceAnchors, faceDetectedFlag,
      lastBlazefaceAt, lastInferenceAt,
      livenessSpec, recognitionSpec,
      reportInference, resize,
    ]
  );

  useImperativeHandle(ref, () => ({
    async capturePhoto() {
      if (!cameraRef.current) throw new Error('Camera is not ready yet.');
      return cameraRef.current.takePhoto({ flash: 'off' });
    },
  }));

  useEffect(() => {
    if (!hasPermission) requestPermission();
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
      onError={(e) => console.log('[Camera] error:', e)}
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
  icon:    { fontSize: 16, color: '#5C6B3A', fontWeight: '900', marginBottom: 10 },
  text:    { color: '#5C6B3A', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  subText: { color: '#7A8A6A', fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 8 },
});
