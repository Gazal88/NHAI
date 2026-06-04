const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

const emptyModule = path.resolve(__dirname, 'src/empty-module.js');

// Block Node.js built-ins and OpenTelemetry — not available in React Native
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith('@opentelemetry/') ||
    moduleName === 'stream' ||
    moduleName === 'ws' ||
    moduleName === 'net' ||
    moduleName === 'tls' ||
    moduleName === 'fs' ||
    moduleName === 'http' ||
    moduleName === 'https' ||
    moduleName === 'zlib' ||
    moduleName === 'crypto'
  ) {
    return { type: 'sourceFile', filePath: emptyModule };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
