// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  // Inlining variables breaks PlatformColor inside CSS variables.
  inlineVariables: false,
  // className support is added explicitly through the wrappers in src/tw.
  globalClassNamePolyfill: false,
});
