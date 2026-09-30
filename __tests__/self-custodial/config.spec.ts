import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  hasSparkAddressShape,
  isRegtestNetwork,
  lnurlDomainFor,
  lnurlDomainsFor,
  resolveLnurlServer,
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
  it("accepts a mainnet Spark address (spark1 HRP)", () => {
    expect(hasSparkAddressShape("spark1qabcdefghijklmn")).toBe(true)
  })

  it("accepts a regtest Spark address (sparkrt1 HRP)", () => {
    expect(hasSparkAddressShape("sparkrt1qabcdefghijklmn")).toBe(true)
  })

  it("is case-insensitive on the HRP", () => {
    expect(hasSparkAddressShape("SPARK1QABCDEFGHIJKLMN")).toBe(true)
    expect(hasSparkAddressShape("SPARKRT1QABCDEFGHIJKLMN")).toBe(true)
    expect(hasSparkAddressShape("Spark1qabcdefghijklmn")).toBe(true)
    expect(hasSparkAddressShape("SparkRt1qabcdefghijklmn")).toBe(true)
  })

  it("trims surrounding whitespace before applying the shape check", () => {
    expect(hasSparkAddressShape("   spark1qabcdefghijklmn  ")).toBe(true)
    expect(hasSparkAddressShape("\nsparkrt1qabcdefghijklmn\t")).toBe(true)
  })

  it("rejects the legacy sp1/sprt1 HRPs that predate the current address format", () => {
    expect(hasSparkAddressShape("sp1qabcdefghijklmn")).toBe(false)
    expect(hasSparkAddressShape("sprt1qabcdefghijklmn")).toBe(false)
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
    expect(hasSparkAddressShape("garbage-spark1qabc")).toBe(false)
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

describe("lnurlDomainFor", () => {
  it("uses the production Blink LNURL host on mainnet", () => {
    expect(lnurlDomainFor(Network.Mainnet)).toBe("blink.sv")
  })

  it("uses the staging Blink LNURL host on regtest", () => {
    expect(lnurlDomainFor(Network.Regtest)).toBe("staging.blink.sv")
  })
})

/**
 * The guard on the host the mode requests reach. It has to be the host the account's
 * address is spelled with, which is what serves the authenticated `/lnurlpay/{pubkey}`
 * routes the mode endpoint sits beside. The custodial `lnAddressHostname` is a different
 * service (`pay.staging.blink.sv` fronts the payment app) and answers those routes with
 * its own 404, so pointing there would look like a healthy request that never lands.
 */
describe("resolveLnurlServer", () => {
  /** Pure in both arguments: no global to reset between these, which is the point of
   *  taking the override rather than reading it. */
  const real = (network: Network) => resolveLnurlServer(network, null)

  it("reaches the production LNURL server on mainnet", () => {
    expect(real(Network.Mainnet).serverUrl).toBe("https://blink.sv")
  })

  it("reaches the staging LNURL server on regtest", () => {
    expect(real(Network.Regtest).serverUrl).toBe("https://staging.blink.sv")
  })

  it("keeps mainnet and regtest on separate servers", () => {
    expect(real(Network.Mainnet).serverUrl).not.toBe(real(Network.Regtest).serverUrl)
  })

  /** Both deployments are public and TLS-terminated; a plain-http request would be
   *  sending a signed pubkey in the clear. */
  it("always speaks https", () => {
    expect(real(Network.Mainnet).serverUrl).toMatch(/^https:\/\//)
    expect(real(Network.Regtest).serverUrl).toMatch(/^https:\/\//)
  })

  it("stays on the exact host the address is spelled with", () => {
    for (const network of [Network.Mainnet, Network.Regtest]) {
      expect(real(network)).toEqual({
        serverUrl: `https://${lnurlDomainFor(network)}`,
        domain: lnurlDomainFor(network),
      })
    }
  })

  describe("with a simulated outage host", () => {
    it("points both halves at it", () => {
      expect(resolveLnurlServer(Network.Mainnet, "127.0.0.1:1")).toEqual({
        serverUrl: "http://127.0.0.1:1",
        domain: "127.0.0.1:1",
      })
    })

    it("drops to http, so the failure is a transport error and not a TLS one", () => {
      expect(resolveLnurlServer(Network.Mainnet, "192.0.2.1").serverUrl).toMatch(
        /^http:\/\//,
      )
    })

    it("overrides the network, since a black hole has no network of its own", () => {
      expect(resolveLnurlServer(Network.Mainnet, "192.0.2.1")).toEqual(
        resolveLnurlServer(Network.Regtest, "192.0.2.1"),
      )
    })
  })

  /** The domains the app *recognises* as its own are a parsing rule, not a destination.
   *  An outage must not reach them, or a scanned Blink pay code would stop being read as
   *  naming one of our accounts. */
  it("leaves the recognised-domain list alone", () => {
    resolveLnurlServer(Network.Mainnet, "192.0.2.1")

    expect(lnurlDomainsFor(Network.Mainnet)).not.toContain("192.0.2.1")
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
