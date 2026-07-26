/**
 * ModelAssetLoader.js
 *
 * Copies bundled .tflite models from the APK assets to the app's
 * writable files directory on first run, then returns file:// URIs
 * that react-native-fast-tflite can load reliably in release builds.
 */
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

const MODEL_FILES = [
  { key: 'liveness',    module: require('../../assets/models/liveness.tflite') },
  { key: 'recognition', module: require('../../assets/models/mobilefacenet.tflite') },
  { key: 'blazeface',   module: require('../../assets/models/blazeface.tflite') },
  { key: 'facemesh',    module: require('../../assets/models/facemesh.tflite') },
];

let cachedUris = null;

export async function getModelUris() {
  if (cachedUris) return cachedUris;

  const uris = {};
  for (const { key, module } of MODEL_FILES) {
    const destPath = `${FileSystem.documentDirectory}models/${key}.tflite`;

    // Check if already copied
    const info = await FileSystem.getInfoAsync(destPath);
    if (!info.exists) {
      // Download asset to local filesystem
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      // Ensure directory exists
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}models/`,
        { intermediates: true }
      );
      // Copy from asset cache to our models dir
      await FileSystem.copyAsync({ from: asset.localUri, to: destPath });
    }

    uris[key] = destPath;
  }

  cachedUris = uris;
  return uris;
}
