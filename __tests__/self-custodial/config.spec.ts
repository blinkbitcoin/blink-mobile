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

  it("reads apiKey and tokenIdentifier from env", () => {
    const { SparkConfig } = loadConfig({
      BREEZ_API_KEY: "my-key",
      SPARK_TOKEN_IDENTIFIER: "my-token",
    })

    expect(SparkConfig.apiKey).toBe("my-key")
    expect(SparkConfig.tokenIdentifier).toBe("my-token")
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
