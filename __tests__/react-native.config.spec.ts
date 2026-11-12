let mockIsInstalled = false
jest.mock("../scripts/meawallet-mpp", () => ({
  root: "/repo/vendor/meawallet/react-native-mpp",
  isInstalled: () => mockIsInstalled,
}))

type ReactNativeConfig = { dependencies: Record<string, { root: string }> }

/** The config is read once, as the CLI loads it, so each case loads its own copy. */
const loadConfig = (): ReactNativeConfig => {
  let config: ReactNativeConfig | undefined
  jest.isolateModules(() => {
    config = require("../react-native.config")
  })
  return config!
}

describe("react-native.config", () => {
  it("links nothing extra where the MeaWallet SDK is not vendored", () => {
    mockIsInstalled = false

    expect(loadConfig().dependencies).toEqual({})
  })

  it("links the vendored MeaWallet SDK where it is installed", () => {
    mockIsInstalled = true

    expect(loadConfig().dependencies).toEqual({
      "@meawallet/react-native-mpp": { root: "/repo/vendor/meawallet/react-native-mpp" },
    })
  })
})

/** Keeps this spec a module, so its names stay its own. */
export {}
