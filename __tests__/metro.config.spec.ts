/** Metro's own defaults do not load under jest, and only this repo's resolver is under
 *  test, so the merge hands back what the config adds. */
jest.mock("@react-native/metro-config", () => ({
  getDefaultConfig: () => ({
    resolver: { assetExts: ["png", "svg"], sourceExts: ["js"] },
  }),
  mergeConfig: (_defaults: object, config: object) => config,
}))

let mockIsInstalled = false
jest.mock("../scripts/meawallet-mpp", () => ({
  root: "/repo/vendor/meawallet/react-native-mpp",
  isInstalled: () => mockIsInstalled,
}))

type MetroConfig = { resolver: { extraNodeModules: Record<string, string> } }

/** The config is read once, as Metro starts, so each case loads its own copy. */
const loadConfig = (): MetroConfig => {
  let config: MetroConfig | undefined
  jest.isolateModules(() => {
    config = require("../metro.config")
  })
  return config!
}

describe("metro.config", () => {
  it("resolves nothing extra where the MeaWallet SDK is not vendored", () => {
    mockIsInstalled = false

    expect(loadConfig().resolver.extraNodeModules).not.toHaveProperty(
      "@meawallet/react-native-mpp",
    )
  })

  it("resolves the package to the vendored SDK where it is installed", () => {
    mockIsInstalled = true

    expect(loadConfig().resolver.extraNodeModules).toHaveProperty(
      "@meawallet/react-native-mpp",
      "/repo/vendor/meawallet/react-native-mpp",
    )
  })
})

/** Keeps this spec a module, so its names stay its own. */
export {}
