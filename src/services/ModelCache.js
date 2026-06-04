import { Asset } from 'expo-asset';

let preloadStarted = false;

export function preloadModels() {
  if (preloadStarted) return;
  preloadStarted = true;
  _doPreload().catch((e) => {
    console.log('[ModelCache] Preload error:', e?.message ?? e);
  });
}

async function _doPreload() {
  let loadTensorflowModel;
  try {
    ({ loadTensorflowModel } = require('react-native-fast-tflite'));
  } catch {
    return;
  }

  try {
    // Resolve asset URIs via expo-asset — works correctly in both dev and release APK
    const [l, r] = await Promise.all([
      Asset.fromModule(require('../../assets/models/liveness.tflite')).downloadAsync(),
      Asset.fromModule(require('../../assets/models/mobilefacenet.tflite')).downloadAsync(),
    ]);

    await Promise.allSettled([
      loadTensorflowModel({ url: l.localUri }, []),
      loadTensorflowModel({ url: r.localUri }, []),
    ]);

    console.log('[ModelCache] Models preloaded ✓');
  } catch (e) {
    console.log('[ModelCache] Preload failed:', e?.message);
  }
}
