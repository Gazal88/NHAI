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

  const results = await Promise.allSettled([
    loadTensorflowModel(require('../../assets/models/liveness.tflite'), []),
    loadTensorflowModel(require('../../assets/models/mobilefacenet.tflite'), []),
  ]);

  results.forEach((r, i) => {
    const name = i === 0 ? 'liveness' : 'mobilefacenet';
    if (r.status === 'fulfilled') {
      console.log(`[ModelCache] ${name} preloaded ✓`);
    } else {
      console.log(`[ModelCache] ${name} preload failed:`, r.reason?.message);
    }
  });
}
