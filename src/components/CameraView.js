import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────
const RECOGNITION_THRESHOLD = 0.75;

const BLAZEFACE_INPUT_SIZE = 128;
const BLAZEFACE_ANCHORS_COUNT = 896;
const BLAZEFACE_SCORE_THRESHOLD = 0.35;

const BLAZEFACE_TICK_MS = 250;
const INFERENCE_TICK_MS = 350;

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
  return new Float32Array(anchors);
}

// ─── Worklet helpers ───────────────────────────────────────────────────────
const sigmoid = (x) => {
  'worklet';
  if (x >= 0) return 1.0 / (1.0 + Math.exp(-x));
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
  if (dataType === 'uint8') { const v = new Uint8Array(buffer); return v.length > 0 ? v[0] / 255 : null; }
  if (dataType === 'int8')  { const v = new Int8Array(buffer);  return v.length > 0 ? (v[0] + 128) / 255 : null; }
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

const LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144];

const distance = (x1, y1, z1, x2, y2, z2) => {
  'worklet';
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const computeEarForEye = (landmarks, indices) => {
  'worklet';
  const p = [];
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    p.push({
      x: landmarks[idx * 3],
      y: landmarks[idx * 3 + 1],
      z: landmarks[idx * 3 + 2]
    });
  }
  const v1 = distance(p[1].x, p[1].y, p[1].z, p[5].x, p[5].y, p[5].z);
  const v2 = distance(p[2].x, p[2].y, p[2].z, p[4].x, p[4].y, p[4].z);
  const h = distance(p[0].x, p[0].y, p[0].z, p[3].x, p[3].y, p[3].z);
  return (v1 + v2) / (2.0 * h + 1e-9);
};

const computeEar = (landmarks) => {
  'worklet';
  const leftEar = computeEarForEye(landmarks, LEFT_EYE_INDICES);
  const rightEar = computeEarForEye(landmarks, RIGHT_EYE_INDICES);
  return (leftEar + rightEar) / 2.0;
};

const computeYaw = (landmarks) => {
  'worklet';
  const noseX = landmarks[1 * 3];
  const leftFaceX = landmarks[234 * 3];
  const rightFaceX = landmarks[454 * 3];
  const midX = (leftFaceX + rightFaceX) / 2.0;
  const halfWidth = (rightFaceX - leftFaceX) / 2.0 + 1e-9;
  const offset = (noseX - midX) / halfWidth;
  return -offset * 45.0;
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
const CameraView = forwardRef(function CameraView({ onInference, runGestureCheck }, ref) {
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

  return <CameraPreview ref={ref} cameraModules={cameraModules} onInference={onInference} runGestureCheck={runGestureCheck} />;
});

export default CameraView;

// ─── CameraPreview (inner) ─────────────────────────────────────────────────
const CameraPreview = forwardRef(function CameraPreview({ cameraModules, onInference, runGestureCheck }, ref) {
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

  const livenessPlugin    = useTensorflowModel(require('../../assets/models/liveness.tflite'), []);
  const recognitionPlugin = useTensorflowModel(require('../../assets/models/mobilefacenet.tflite'), []);
  const blazefacePlugin   = useTensorflowModel(require('../../assets/models/blazeface.tflite'), []);

  const livenessModel    = livenessPlugin.state    === 'loaded' ? livenessPlugin.model    : null;
  const recognitionModel = recognitionPlugin.state === 'loaded' ? recognitionPlugin.model : null;
  const blazefaceModel   = blazefacePlugin.state   === 'loaded' ? blazefacePlugin.model   : null;

  const boxedLiveness    = useMemo(() => livenessModel    ? NitroModules.box(livenessModel)    : null, [NitroModules, livenessModel]);
  const boxedRecognition = useMemo(() => recognitionModel ? NitroModules.box(recognitionModel) : null, [NitroModules, recognitionModel]);
  const boxedBlazeface   = useMemo(() => blazefaceModel   ? NitroModules.box(blazefaceModel)   : null, [NitroModules, blazefaceModel]);
  const boxedFacemesh    = null;

  const livenessSpec    = useMemo(() => getTensorSpec(livenessModel,    { width: 224, height: 224 }), [livenessModel]);
  const recognitionSpec = useMemo(() => getTensorSpec(recognitionModel, { width: 112, height: 112 }), [recognitionModel]);
  const facemeshSpec     = { width: 192, height: 192, dataType: 'float32', pixelFormat: 'rgb', outputType: 'float32' };

  const runGestureCheckShared = useMemo(() => Worklets.createSharedValue(false), [Worklets]);
  useEffect(() => {
    runGestureCheckShared.value = !!runGestureCheck;
  }, [runGestureCheck, runGestureCheckShared]);

  const blazefaceAnchors = useMemo(() => Worklets.createSharedValue(generateBlazeFaceAnchors()), [Worklets]);
  const reportInference  = useMemo(() => Worklets.createRunOnJS((r) => onInference?.(r)), [Worklets, onInference]);
  const lastBlazefaceAt  = useMemo(() => Worklets.createSharedValue(0), [Worklets]);
  const lastInferenceAt  = useMemo(() => Worklets.createSharedValue(0), [Worklets]);
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

      if (boxedBlazeface != null && now - lastBlazefaceAt.value >= BLAZEFACE_TICK_MS) {
        lastBlazefaceAt.value = now;
        try {
          const bf = boxedBlazeface.unbox();
          const bfInput = resize(frame, {
            scale: { width: BLAZEFACE_INPUT_SIZE, height: BLAZEFACE_INPUT_SIZE },
            pixelFormat: 'rgb', dataType: 'float32',
          });
          const bfOut = bf.runSync([sliceBuffer(bfInput)]);
          faceDetectedFlag.value = parseBlazeface(bfOut[0], bfOut[1], blazefaceAnchors.value) !== null;
        } catch (_) {}
      }

      const tickMs = runGestureCheckShared.value ? 120 : INFERENCE_TICK_MS;
      if (now - lastInferenceAt.value < tickMs) return;
      lastInferenceAt.value = now;

      try {
        const liveness    = boxedLiveness.unbox();
        const recognition = boxedRecognition.unbox();

        const livenessInput = resize(frame, {
          scale: { width: livenessSpec.width, height: livenessSpec.height },
          pixelFormat: livenessSpec.pixelFormat, dataType: livenessSpec.dataType,
        });
        const livenessOutput = liveness.runSync([sliceBuffer(livenessInput)]);
        const rawLogit = firstValue(livenessOutput[0], livenessSpec.outputType);
        const livenessScore = rawLogit == null ? null : sigmoid(rawLogit);

        const recognitionInput = resize(frame, {
          scale: { width: recognitionSpec.width, height: recognitionSpec.height },
          pixelFormat: recognitionSpec.pixelFormat, dataType: recognitionSpec.dataType,
        });
        const recognitionOutput = recognition.runSync([sliceBuffer(recognitionInput)]);
        const embedding = bufferToNumberArray(recognitionOutput[0], recognitionSpec.outputType, 512);

        let ear = null;
        let yaw = null;

        if (runGestureCheckShared.value && boxedFacemesh != null) {
          try {
            const facemesh = boxedFacemesh.unbox();
            const facemeshInput = resize(frame, {
              scale: { width: facemeshSpec.width, height: facemeshSpec.height },
              pixelFormat: facemeshSpec.pixelFormat, dataType: facemeshSpec.dataType,
            });
            const facemeshOutput = facemesh.runSync([sliceBuffer(facemeshInput)]);
            const landmarks = bufferToNumberArray(facemeshOutput[0], facemeshSpec.outputType, 1404);
            if (landmarks && landmarks.length >= 1404) {
              ear = computeEar(landmarks);
              yaw = computeYaw(landmarks);
            }
          } catch (_) {}
        }

        reportInference({
          ready: true, timestamp: now, livenessScore, embedding,
          recognitionThreshold: RECOGNITION_THRESHOLD,
          faceDetected: faceDetectedFlag.value,
          ear,
          yaw,
        });
      } catch (error) {
        reportInference({ ready: false, timestamp: Date.now(), error: String(error?.message ?? error) });
      }
    },
    [
      boxedLiveness, boxedRecognition, boxedBlazeface, boxedFacemesh,
      blazefaceAnchors, faceDetectedFlag,
      lastBlazefaceAt, lastInferenceAt,
      livenessSpec, recognitionSpec, facemeshSpec,
      reportInference, resize, runGestureCheckShared,
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
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EEF0E8', paddingHorizontal: 20,
  },
  icon:    { fontSize: 16, color: '#5C6B3A', fontWeight: '900', marginBottom: 10 },
  text:    { color: '#5C6B3A', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  subText: { color: '#7A8A6A', fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 8 },
});
