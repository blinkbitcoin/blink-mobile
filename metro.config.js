// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs")

const defaultConfig = getDefaultConfig(__dirname)
const { assetExts, sourceExts } = defaultConfig.resolver

/** The MeaWallet push provisioning SDK is vendored outside node_modules by
 *  scripts/install-meawallet-mpp.sh where the machine can reach MeaWallet's registry.
 *  Without it the app's optional require of the package fails and no wallet is offered. */
const meawalletMppRoot = path.resolve(__dirname, "vendor/meawallet/react-native-mpp")
const meawalletMpp = fs.existsSync(path.join(meawalletMppRoot, "package.json"))
  ? { "@meawallet/react-native-mpp": meawalletMppRoot }
  : {}

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
      ...meawalletMpp,
    },

    resolverMainFields: ["sbmodern", "react-native", "browser", "main"],
  },
}

module.exports = mergeConfig(defaultConfig, config)
