/**
 * ModelCache.js
 *
 * Starts loading the two core TFLite models (liveness + MobileFaceNet)
 * in the background as early as possible — called from App.js during
 * the LaunchScreen phase while SQLite is initialising.
 *
 * CameraView's useTensorflowModel hook loads from the same asset paths,
 * so the native TFLite runtime reuses the already-loaded interpreter
 * instead of loading from scratch. This cuts warmup time on mid-range devices.
 *
 * Uses lazy require so it never runs on web or if native modules
 * are unavailable. All errors are caught silently.
 */

let preloadStarted = false;

export function preloadModels() {
  // Only run once, never on web
  if (preloadStarted) return;
  preloadStarted = true;

  // Run async without awaiting
  _doPreload().catch((e) => {
    console.log('[ModelCache] Preload error:', e?.message ?? e);
  });
}

async function _doPreload() {
  let loadTensorflowModel;
  try {
    ({ loadTensorflowModel } = require('react-native-fast-tflite'));
  } catch {
    // Native module not available (web / bare JS environment)
    return;
  }

  // Load the two core models concurrently.
  // BlazeFace is small and optional — skip it here to keep memory pressure low.
  // useTensorflowModel in CameraView will load BlazeFace on its own.
  const results = await Promise.allSettled([
    loadTensorflowModel(
      require('../../assets/models/liveness.tflite'),
      [] // no delegates — CPU only, matches CameraView
    ),
    loadTensorflowModel(
      require('../../assets/models/mobilefacenet.tflite'),
      []
    ),
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
