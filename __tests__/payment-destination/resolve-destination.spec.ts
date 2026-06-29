/* eslint-disable camelcase */
import { Network as SparkNetwork } from "@breeztech/breez-sdk-spark-react-native"

import { Network } from "@app/graphql/generated"

import { resolveDestination } from "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination"

const mockParseDestination = jest.fn()
const mockParseSparkAddress = jest.fn()
const mockResolveSparkDestination = jest.fn()
const mockWrapDestination = jest.fn()
const mockResolveUsername = jest.fn()

jest.mock("@app/screens/send-bitcoin-screen/payment-destination/index", () => ({
  parseDestination: (...args: unknown[]) => mockParseDestination(...args),
}))

jest.mock("@app/screens/send-bitcoin-screen/payment-destination/spark", () => ({
  resolveSparkDestination: (...args: unknown[]) => mockResolveSparkDestination(...args),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  parseSparkAddress: (...args: unknown[]) => mockParseSparkAddress(...args),
}))

jest.mock("@app/self-custodial/payment-details/wrap-destination", () => ({
  wrapDestination: (...args: unknown[]) => mockWrapDestination(...args),
}))

jest.mock(
  "@app/screens/send-bitcoin-screen/payment-destination/resolve-username",
  () => ({
    resolveUsername: (...args: unknown[]) => mockResolveUsername(...args),
  }),
)

const baseParams = {
  rawInput: "lnbc1...",
  myWalletIds: ["w-1"],
  bitcoinNetwork: Network.Mainnet,
  lnurlDomains: ["blink.sv"],
  accountDefaultWalletQuery: jest.fn() as never,
}

const lnAddressHostname = "blink.sv"
const fakeSdk = { id: "sdk" } as never

describe("resolveDestination", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("custodial path (sdk = null)", () => {
    it("returns a resolved destination unchanged without an LNURL fallback", async () => {
      const parsed = { valid: true, validDestination: { paymentType: "Lightning" } }
      mockParseDestination.mockResolvedValue(parsed)

      const result = await resolveDestination(
        baseParams,
        { sdk: null, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      expect(mockParseDestination).toHaveBeenCalledTimes(1)
      expect(mockParseSparkAddress).not.toHaveBeenCalled()
      expect(mockResolveUsername).not.toHaveBeenCalled()
      expect(mockWrapDestination).not.toHaveBeenCalled()
      expect(result).toBe(parsed)
    })

    it("re-resolves an unresolved Blink username as a lightning address over LNURL", async () => {
      const unresolved = { valid: false, invalidReason: "UsernameDoesNotExist" }
      const lnurlResolved = { valid: true, validDestination: { paymentType: "Lnurl" } }
      mockParseDestination
        .mockResolvedValueOnce(unresolved)
        .mockResolvedValueOnce(lnurlResolved)

      const result = await resolveDestination(
        baseParams,
        { sdk: null, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      expect(mockParseDestination).toHaveBeenNthCalledWith(1, baseParams)
      expect(mockParseDestination).toHaveBeenNthCalledWith(2, {
        ...baseParams,
        preferLnurlForInternalHandles: true,
      })
      expect(mockResolveUsername).not.toHaveBeenCalled()
      expect(result).toBe(lnurlResolved)
    })

    it("does not fall back when the destination is invalid for a reason other than a missing username", async () => {
      const invalid = { valid: false, invalidReason: "WrongNetwork" }
      mockParseDestination.mockResolvedValue(invalid)

      const result = await resolveDestination(
        baseParams,
        { sdk: null, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      expect(mockParseDestination).toHaveBeenCalledTimes(1)
      expect(result).toBe(invalid)
    })

    it("does not attempt the Spark pre-check when sdk is null", async () => {
      mockParseDestination.mockResolvedValue({ valid: false })

      await resolveDestination(
        baseParams,
        { sdk: null, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      expect(mockParseSparkAddress).not.toHaveBeenCalled()
    })
  })

  describe("self-custodial path (sdk present)", () => {
    it("wraps the resolved Spark destination when parseSparkAddress matches", async () => {
      const sparkParsed = {
        address: "spark1qabc",
        identityPublicKey: "pk",
        networkMatch: true,
      }
      const sparkResolved = { valid: true, validDestination: { paymentType: "spark" } }
      const wrapped = { ...sparkResolved, createPaymentDetail: jest.fn() }

      mockParseSparkAddress.mockResolvedValue(sparkParsed)
      mockResolveSparkDestination.mockReturnValue(sparkResolved)
      mockWrapDestination.mockReturnValue(wrapped)

      const result = await resolveDestination(
        { ...baseParams, rawInput: "sparkrt1qabc" },
        { sdk: fakeSdk, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      expect(mockParseSparkAddress).toHaveBeenCalledWith(
        fakeSdk,
        "sparkrt1qabc",
        SparkNetwork.Regtest,
      )
      expect(mockResolveSparkDestination).toHaveBeenCalledWith(sparkParsed)
      expect(mockWrapDestination).toHaveBeenCalledWith(sparkResolved, fakeSdk)
      expect(mockParseDestination).not.toHaveBeenCalled()
      expect(mockResolveUsername).not.toHaveBeenCalled()
      expect(result).toBe(wrapped)
    })

    it("routes a wrong-network Spark address through resolveSparkDestination without falling through to the generic parser", async () => {
      const sparkParsed = {
        address: "spark1qabc",
        identityPublicKey: "pk",
        networkMatch: false,
      }
      const sparkResolved = { valid: false, invalidReason: "WrongNetwork" }
      const wrapped = { ...sparkResolved }

      mockParseSparkAddress.mockResolvedValue(sparkParsed)
      mockResolveSparkDestination.mockReturnValue(sparkResolved)
      mockWrapDestination.mockReturnValue(wrapped)

      const result = await resolveDestination(
        { ...baseParams, rawInput: "spark1qabc" },
        { sdk: fakeSdk, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      expect(mockResolveSparkDestination).toHaveBeenCalledWith(sparkParsed)
      expect(mockParseDestination).not.toHaveBeenCalled()
      expect(mockResolveUsername).not.toHaveBeenCalled()
      expect(result).toBe(wrapped)
    })

    it("resolves the parsed destination via resolveUsername, then wraps it", async () => {
      const parsed = { valid: true, validDestination: { paymentType: "Intraledger" } }
      const resolved = { valid: true, validDestination: { paymentType: "Lnurl" } }
      const wrapped = { ...resolved, createPaymentDetail: jest.fn() }

      mockParseSparkAddress.mockResolvedValue(null)
      mockParseDestination.mockResolvedValue(parsed)
      mockResolveUsername.mockResolvedValue(resolved)
      mockWrapDestination.mockReturnValue(wrapped)

      const result = await resolveDestination(
        baseParams,
        { sdk: fakeSdk, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      expect(mockParseDestination).toHaveBeenCalledWith(baseParams)
      expect(mockResolveUsername).toHaveBeenCalledWith(
        parsed,
        lnAddressHostname,
        expect.any(Function),
      )
      expect(mockWrapDestination).toHaveBeenCalledWith(resolved, fakeSdk)
      expect(result).toBe(wrapped)
    })

    it("injects a re-parse callback that re-parses the Lightning Address against the same params", async () => {
      const parsed = { valid: true, validDestination: { paymentType: "Intraledger" } }

      mockParseSparkAddress.mockResolvedValue(null)
      mockParseDestination.mockResolvedValue(parsed)
      mockResolveUsername.mockResolvedValue(parsed)
      mockWrapDestination.mockReturnValue(parsed)

      await resolveDestination(
        baseParams,
        { sdk: fakeSdk, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      const resolveLnAddress = mockResolveUsername.mock.calls[0][2]
      mockParseDestination.mockClear()
      await resolveLnAddress("esaudeveloper@blink.sv")

      expect(mockParseDestination).toHaveBeenCalledWith({
        ...baseParams,
        rawInput: "esaudeveloper@blink.sv",
      })
    })

    it("wraps whatever resolveUsername returns, including invalid results", async () => {
      const invalid = { valid: false, invalidReason: "UnknownDestination" }

      mockParseSparkAddress.mockResolvedValue(null)
      mockParseDestination.mockResolvedValue(invalid)
      mockResolveUsername.mockResolvedValue(invalid)
      mockWrapDestination.mockReturnValue(invalid)

      const result = await resolveDestination(
        baseParams,
        { sdk: fakeSdk, network: SparkNetwork.Regtest },
        lnAddressHostname,
      )

      expect(mockWrapDestination).toHaveBeenCalledWith(invalid, fakeSdk)
      expect(result).toBe(invalid)
    })
  })
})
