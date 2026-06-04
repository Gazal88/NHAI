const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

// Block @opentelemetry packages — they use dynamic import() which breaks
// Hermes on iOS release builds. Supabase pulls these in optionally.
const emptyModule = path.resolve(__dirname, 'src/empty-module.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@opentelemetry/')) {
    return { type: 'sourceFile', filePath: emptyModule };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
