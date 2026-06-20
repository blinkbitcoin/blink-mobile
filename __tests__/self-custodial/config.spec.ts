import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  hasSparkAddressShape,
  isRegtestNetwork,
  mismatchedNetworkLabel,
  networkForInstance,
  networkLabelFor,
  storageDirFor,
} from "@app/self-custodial/config"

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

describe("networkForInstance", () => {
  it("maps the Main instance to mainnet", () => {
    expect(networkForInstance("Main")).toBe(Network.Mainnet)
  })

  it("maps the Staging instance to regtest", () => {
    expect(networkForInstance("Staging")).toBe(Network.Regtest)
  })

  it("maps the Local instance to regtest", () => {
    expect(networkForInstance("Local")).toBe(Network.Regtest)
  })

  it("maps a Custom instance to regtest", () => {
    expect(networkForInstance("Custom")).toBe(Network.Regtest)
  })
})

describe("networkLabelFor", () => {
  it("labels mainnet", () => {
    expect(networkLabelFor(Network.Mainnet)).toBe("mainnet")
  })

  it("labels regtest", () => {
    expect(networkLabelFor(Network.Regtest)).toBe("regtest")
  })
})

describe("isRegtestNetwork", () => {
  it("is true for regtest", () => {
    expect(isRegtestNetwork(Network.Regtest)).toBe(true)
  })

  it("is false for mainnet", () => {
    expect(isRegtestNetwork(Network.Mainnet)).toBe(false)
  })
})

describe("mismatchedNetworkLabel", () => {
  it("returns null when there is no stored label", () => {
    expect(mismatchedNetworkLabel(null, Network.Regtest)).toBeNull()
  })

  it("returns null when the stored label matches the current network", () => {
    expect(mismatchedNetworkLabel("regtest", Network.Regtest)).toBeNull()
    expect(mismatchedNetworkLabel("mainnet", Network.Mainnet)).toBeNull()
  })

  it("returns the stored label when it conflicts with the current network", () => {
    expect(mismatchedNetworkLabel("mainnet", Network.Regtest)).toBe("mainnet")
    expect(mismatchedNetworkLabel("regtest", Network.Mainnet)).toBe("regtest")
  })
})

describe("storageDirFor", () => {
  it("scopes the account storage path by network", () => {
    expect(storageDirFor("acct-1", Network.Mainnet)).toBe(
      "/test/documents/breez-sdk-spark-mainnet/acct-1",
    )
    expect(storageDirFor("acct-1", Network.Regtest)).toBe(
      "/test/documents/breez-sdk-spark-regtest/acct-1",
    )
  })
})

describe("required build config", () => {
  beforeEach(() => {
    jest.resetModules()
  })

  const loadConfig = (env: Record<string, string> = {}) => {
    jest.doMock("react-native-config", () => ({
      BREEZ_API_KEY: "test-api-key",
      SPARK_TOKEN_IDENTIFIER: "test-token-id",
      ...env,
    }))
    return require("@app/self-custodial/config")
  }

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
})
