// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path")

const defaultConfig = getDefaultConfig(__dirname)
const { assetExts, sourceExts } = defaultConfig.resolver

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        // Enable inline requires for improved startup performance
        // This lazy-loads modules only when they're actually used,
        // reducing the initial JavaScript bundle parse time.
        // Expected impact: 0.5-1s faster startup on Android
        // See: https://reactnative.dev/docs/performance#inline-requires
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...sourceExts, "svg", "cjs", "json"],

    // unclear those 2 below are needed
    extraNodeModules: {
      stream: path.resolve(__dirname, "node_modules/readable-stream"),
      zlib: path.resolve(__dirname, "node_modules/browserify-zlib"),
    },

    resolverMainFields: ["sbmodern", "react-native", "browser", "main"],
  },
}

module.exports = mergeConfig(defaultConfig, config)
