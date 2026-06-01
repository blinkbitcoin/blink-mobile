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

  it("maps Main instance to mainnet", () => {
    const { sparkNetworkFromGaloyInstanceId } = loadConfig()

    expect(sparkNetworkFromGaloyInstanceId("Main")).toBe(0)
  })

  it("maps Staging and Local instances to regtest", () => {
    const { sparkNetworkFromGaloyInstanceId } = loadConfig()

    expect(sparkNetworkFromGaloyInstanceId("Staging")).toBe(1)
    expect(sparkNetworkFromGaloyInstanceId("Local")).toBe(1)
  })

  it("maps Custom instance to mainnet default", () => {
    const { sparkNetworkFromGaloyInstanceId } = loadConfig()

    expect(sparkNetworkFromGaloyInstanceId("Custom")).toBe(0)
  })

  it("builds storage dir for mainnet and regtest labels", () => {
    const { sparkStorageDir } = loadConfig()

    expect(sparkStorageDir("mainnet")).toBe("/test/documents/breez-sdk-spark-mainnet")
    expect(sparkStorageDir("regtest")).toBe("/test/documents/breez-sdk-spark-regtest")
  })

  it("scopes account storage dir by network label", () => {
    const { storageDirFor } = loadConfig()

    expect(storageDirFor("mainnet", "acct-1")).toBe(
      "/test/documents/breez-sdk-spark-mainnet/acct-1",
    )
    expect(storageDirFor("regtest", "acct-2")).toBe(
      "/test/documents/breez-sdk-spark-regtest/acct-2",
    )
  })

  it("derives network label from galoy instance id", () => {
    const { sparkNetworkLabelFromGaloyInstanceId } = loadConfig()

    expect(sparkNetworkLabelFromGaloyInstanceId("Main")).toBe("mainnet")
    expect(sparkNetworkLabelFromGaloyInstanceId("Staging")).toBe("regtest")
    expect(sparkNetworkLabelFromGaloyInstanceId("Local")).toBe("regtest")
    expect(sparkNetworkLabelFromGaloyInstanceId("Custom")).toBe("mainnet")
  })

  it("reads apiKey from env", () => {
    const { SparkConfig } = loadConfig({ BREEZ_API_KEY: "my-key" })

    expect(SparkConfig.apiKey).toBe("my-key")
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

  it("derives network label from spark network enum", () => {
    const { sparkNetworkLabelFromNetwork } = loadConfig()

    expect(sparkNetworkLabelFromNetwork(0)).toBe("mainnet")
    expect(sparkNetworkLabelFromNetwork(1)).toBe("regtest")
  })
})
