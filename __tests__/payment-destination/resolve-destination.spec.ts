/* eslint-disable camelcase */
import { Network } from "@app/graphql/generated"

import { resolveDestination } from "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination"

const mockParseDestination = jest.fn()
const mockParseSparkAddress = jest.fn()
const mockResolveSparkDestination = jest.fn()
const mockWrapDestination = jest.fn()

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

const baseParams = {
  rawInput: "lnbc1...",
  myWalletIds: ["w-1"],
  bitcoinNetwork: Network.Mainnet,
  lnurlDomains: ["blink.sv"],
  accountDefaultWalletQuery: jest.fn() as never,
}

const fakeSdk = { id: "sdk" } as never

describe("resolveDestination", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("custodial path (sdk = null)", () => {
    it("returns parseDestination output unchanged", async () => {
      const parsed = { valid: true, validDestination: { paymentType: "Lightning" } }
      mockParseDestination.mockResolvedValue(parsed)

      const result = await resolveDestination(baseParams, null)

      expect(mockParseSparkAddress).not.toHaveBeenCalled()
      expect(mockWrapDestination).not.toHaveBeenCalled()
      expect(result).toBe(parsed)
    })

    it("does not attempt the Spark pre-check when sdk is null", async () => {
      mockParseDestination.mockResolvedValue({ valid: false })

      await resolveDestination(baseParams, null)

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
      )

      expect(mockParseSparkAddress).toHaveBeenCalledWith(fakeSdk, "sp1qabc")
      expect(mockResolveSparkDestination).toHaveBeenCalledWith(sparkParsed)
      expect(mockWrapDestination).toHaveBeenCalledWith(sparkResolved, fakeSdk)
      expect(mockParseDestination).not.toHaveBeenCalled()
      expect(result).toBe(wrapped)
    })

    it("falls back to parseDestination + wrap when not a Spark address", async () => {
      const parsed = { valid: true, validDestination: { paymentType: "Lightning" } }
      const wrapped = { ...parsed, createPaymentDetail: jest.fn() }

      mockParseSparkAddress.mockResolvedValue(null)
      mockParseDestination.mockResolvedValue(parsed)
      mockWrapDestination.mockReturnValue(wrapped)

      const result = await resolveDestination(baseParams, fakeSdk)

      expect(mockParseDestination).toHaveBeenCalledWith(baseParams)
      expect(mockWrapDestination).toHaveBeenCalledWith(parsed, fakeSdk)
      expect(result).toBe(wrapped)
    })

    it("wraps invalid parsed destinations too (wrapDestination decides what to do)", async () => {
      const invalid = { valid: false, invalidReason: "UnknownDestination" }
      mockParseSparkAddress.mockResolvedValue(null)
      mockParseDestination.mockResolvedValue(invalid)
      mockWrapDestination.mockReturnValue(invalid)

      const result = await resolveDestination(baseParams, fakeSdk)

      expect(mockWrapDestination).toHaveBeenCalledWith(invalid, fakeSdk)
      expect(result).toBe(invalid)
    })
  })
})
