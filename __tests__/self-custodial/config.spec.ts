import { hasSparkAddressShape } from "@app/self-custodial/config"

jest.mock("react-native-config", () => ({}))

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test/documents",
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
}))

const LNURL_INPUT = "lnurl1examplefixtureonly"

describe("hasSparkAddressShape", () => {
  it("accepts a mainnet Spark address (sp1 HRP)", () => {
    expect(hasSparkAddressShape("sp1qabcdefghijklmn")).toBe(true)
  })

  it("accepts a regtest Spark address (sprt1 HRP)", () => {
    expect(hasSparkAddressShape("sprt1qabcdefghijklmn")).toBe(true)
  })

  it("is case-insensitive on the HRP", () => {
    expect(hasSparkAddressShape("SP1QABCDEFGHIJKLMN")).toBe(true)
    expect(hasSparkAddressShape("SPRT1QABCDEFGHIJKLMN")).toBe(true)
  })

  it("trims surrounding whitespace before applying the shape check", () => {
    expect(hasSparkAddressShape("   sp1qabcdefghijklmn  ")).toBe(true)
    expect(hasSparkAddressShape("\nsprt1qabcdefghijklmn\t")).toBe(true)
  })

  it("rejects an LNURL bech32 string (the original regression case)", () => {
    expect(hasSparkAddressShape(LNURL_INPUT)).toBe(false)
  })

  it("rejects a Lightning invoice (lnbc...)", () => {
    expect(hasSparkAddressShape("lnbc100n1pwjlwpzpp5...")).toBe(false)
  })

  it("rejects a Bitcoin bech32 address (bc1q...)", () => {
    expect(hasSparkAddressShape("bc1qabcdefghijklmn")).toBe(false)
  })

  it("rejects a Lightning URI (lightning:...)", () => {
    expect(hasSparkAddressShape("lightning:lnbc100n1...")).toBe(false)
  })

  it("rejects an HTTP URL", () => {
    expect(hasSparkAddressShape("https://example.com/?q=sp1")).toBe(false)
  })

  it("rejects an empty string", () => {
    expect(hasSparkAddressShape("")).toBe(false)
  })

  it("rejects a whitespace-only string", () => {
    expect(hasSparkAddressShape("    ")).toBe(false)
  })

  it("rejects a string that contains a Spark HRP but does not start with one", () => {
    expect(hasSparkAddressShape("garbage-sp1qabc")).toBe(false)
  })
})

describe("SparkConfig", () => {
  beforeEach(() => {
    jest.resetModules()
  })

  const loadConfig = (env: Record<string, string> = {}) => {
    jest.doMock("react-native-config", () => ({
      BREEZ_API_KEY: "test-api-key",
      SPARK_TOKEN_IDENTIFIER: "test-token-id",
      ...env,
    }))
    jest.doMock("react-native-fs", () => ({
      DocumentDirectoryPath: "/test/documents",
    }))
    jest.doMock("@breeztech/breez-sdk-spark-react-native", () => ({
      Network: { Mainnet: 0, Regtest: 1 },
    }))
    return require("@app/self-custodial/config")
  }

  it("defaults to mainnet when BREEZ_NETWORK is not set", () => {
    const { SparkConfig, SparkNetwork } = loadConfig()

    expect(SparkNetwork).toBe(0)
    expect(SparkConfig.network).toBe(0)
  })

  it("parses regtest network", () => {
    const { SparkConfig, SparkNetwork } = loadConfig({ BREEZ_NETWORK: "regtest" })

    expect(SparkNetwork).toBe(1)
    expect(SparkConfig.network).toBe(1)
  })

  it("parses mainnet network (case-insensitive)", () => {
    const { SparkNetwork } = loadConfig({ BREEZ_NETWORK: "Mainnet" })

    expect(SparkNetwork).toBe(0)
  })

  it("throws on unknown network", () => {
    expect(() => loadConfig({ BREEZ_NETWORK: "testnet" })).toThrow(
      'Unknown BREEZ_NETWORK: "testnet"',
    )
  })

  it("scopes storageDir by network — mainnet", () => {
    const { SparkConfig } = loadConfig()

    expect(SparkConfig.storageDir).toBe("/test/documents/breez-sdk-spark-mainnet")
  })

  it("scopes storageDir by network — regtest", () => {
    const { SparkConfig } = loadConfig({ BREEZ_NETWORK: "regtest" })

    expect(SparkConfig.storageDir).toBe("/test/documents/breez-sdk-spark-regtest")
  })

  it("requireBreezApiKey returns the configured key", () => {
    const { requireBreezApiKey } = loadConfig({ BREEZ_API_KEY: "my-key" })

    expect(requireBreezApiKey()).toBe("my-key")
  })

  it("requireBreezApiKey throws a clear error when env is missing", () => {
    const { requireBreezApiKey } = loadConfig({ BREEZ_API_KEY: "" })

    expect(() => requireBreezApiKey()).toThrow(
      "BREEZ_API_KEY is not configured for this build",
    )
  })

  it("requireSparkTokenIdentifier returns the configured identifier", () => {
    const { requireSparkTokenIdentifier } = loadConfig({
      SPARK_TOKEN_IDENTIFIER: "my-token",
    })

    expect(requireSparkTokenIdentifier()).toBe("my-token")
  })

  it("requireSparkTokenIdentifier throws a clear error when env is missing", () => {
    const { requireSparkTokenIdentifier } = loadConfig({ SPARK_TOKEN_IDENTIFIER: "" })

    expect(() => requireSparkTokenIdentifier()).toThrow(
      "SPARK_TOKEN_IDENTIFIER is not configured for this build",
    )
  })

  it("exports SparkNetworkLabel as 'mainnet' for mainnet", () => {
    const { SparkNetworkLabel } = loadConfig()

    expect(SparkNetworkLabel).toBe("mainnet")
  })

  it("exports SparkNetworkLabel as 'regtest' for regtest", () => {
    const { SparkNetworkLabel } = loadConfig({ BREEZ_NETWORK: "regtest" })

    expect(SparkNetworkLabel).toBe("regtest")
  })
})
