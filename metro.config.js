const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */

module.exports = (async () => {
  const baseConfig = await getDefaultConfig(__dirname);

  return mergeConfig(baseConfig, {
    transformer: {
      babelTransformerPath: require.resolve('react-native-svg-transformer'),
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: false,
        },
      }),
    },
    resolver: {
      assetExts: baseConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
      sourceExts: [...baseConfig.resolver.sourceExts, 'svg'],
      extraNodeModules: {
        stream: path.resolve(__dirname, 'node_modules/readable-stream'),
        zlib: path.resolve(__dirname, 'node_modules/browserify-zlib'),
        types: path.resolve(__dirname, '../common/types'),
      },
    },
    projectRoot: path.resolve(__dirname),
    maxWorkers: 2,
  });
})();