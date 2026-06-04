const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Support TFLite model files
config.resolver.assetExts.push('tflite');

// Block OpenTelemetry dynamic import that breaks Hermes on iOS release builds
// This comes from @supabase/supabase-js -> @opentelemetry packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.includes('@opentelemetry') ||
    moduleName.includes('opentelemetry')
  ) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
