/* eslint-disable camelcase */
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
  resolveUsername: (...args: unknown[]) => mockResolveUsername(...args),
}))

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
    it("returns parseDestination output unchanged", async () => {
      const parsed = { valid: true, validDestination: { paymentType: "Lightning" } }
      mockParseDestination.mockResolvedValue(parsed)

      const result = await resolveDestination(baseParams, null, lnAddressHostname)

      expect(mockParseSparkAddress).not.toHaveBeenCalled()
      expect(mockResolveUsername).not.toHaveBeenCalled()
      expect(mockWrapDestination).not.toHaveBeenCalled()
      expect(result).toBe(parsed)
    })

    it("does not attempt the Spark pre-check when sdk is null", async () => {
      mockParseDestination.mockResolvedValue({ valid: false })

      await resolveDestination(baseParams, null, lnAddressHostname)

      expect(mockParseSparkAddress).not.toHaveBeenCalled()
    })
  })

  describe("self-custodial path (sdk present)", () => {
    it("wraps the resolved Spark destination when parseSparkAddress matches", async () => {
      const sparkParsed = { address: "sp1", identityPublicKey: "pk", networkMatch: true }
      const sparkResolved = { valid: true, validDestination: { paymentType: "spark" } }
      const wrapped = { ...sparkResolved, createPaymentDetail: jest.fn() }

      mockParseSparkAddress.mockResolvedValue(sparkParsed)
      mockResolveSparkDestination.mockReturnValue(sparkResolved)
      mockWrapDestination.mockReturnValue(wrapped)

      const result = await resolveDestination(
        { ...baseParams, rawInput: "sp1qabc" },
        fakeSdk,
        lnAddressHostname,
      )

      expect(mockParseSparkAddress).toHaveBeenCalledWith(fakeSdk, "sp1qabc")
      expect(mockResolveSparkDestination).toHaveBeenCalledWith(sparkParsed)
      expect(mockWrapDestination).toHaveBeenCalledWith(sparkResolved, fakeSdk)
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

      const result = await resolveDestination(baseParams, fakeSdk, lnAddressHostname)

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

      await resolveDestination(baseParams, fakeSdk, lnAddressHostname)

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

      const result = await resolveDestination(baseParams, fakeSdk, lnAddressHostname)

      expect(mockWrapDestination).toHaveBeenCalledWith(invalid, fakeSdk)
      expect(result).toBe(invalid)
    })
  })
})
