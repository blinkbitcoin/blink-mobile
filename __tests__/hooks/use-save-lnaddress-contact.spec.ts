import { renderHook } from "@testing-library/react-hooks"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { ContactType } from "@app/graphql/generated"
import { useSaveLnAddressContact } from "@app/screens/send-bitcoin-screen/use-save-lnaddress-contact"

const mockContactCreate = jest.fn()
const mockBridgeFindOrCreateContact = jest.fn()
const mockCrashlyticsLog = jest.fn()
let mockIsSelfCustodial = false
let mockSdk: { id: string } | null = null

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useContactCreateMutation: () => [mockContactCreate],
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: mockIsSelfCustodial }),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => ({ sdk: mockSdk }),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  findOrCreateContact: (...args: unknown[]) => mockBridgeFindOrCreateContact(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: mockCrashlyticsLog,
  recordError: jest.fn(),
}))

describe("useSaveLnAddressContact", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSelfCustodial = false
    mockSdk = null
  })

  it("should save contact for valid lnurl payment (non-merchant)", async () => {
    const { result } = renderHook(() => useSaveLnAddressContact())

    const response = await result.current({
      paymentType: PaymentType.Lnurl,
      destination: "user@example.com",
      isMerchant: false,
    })

    expect(response.saved).toBe(true)
    expect(response.handle).toBe("user@example.com")
    expect(mockContactCreate).toHaveBeenCalledWith({
      variables: {
        input: {
          handle: "user@example.com",
          type: ContactType.Lnaddress,
        },
      },
    })
  })

  it("should not save contact when isMerchant is true", async () => {
    const { result } = renderHook(() => useSaveLnAddressContact())

    const response = await result.current({
      paymentType: PaymentType.Lnurl,
      destination: "merchant@example.com",
      isMerchant: true,
    })

    expect(response.saved).toBe(false)
    expect(response.handle).toBeUndefined()
    expect(mockContactCreate).not.toHaveBeenCalled()
  })

  it("should not save contact when payment type is not lnurl", async () => {
    const { result } = renderHook(() => useSaveLnAddressContact())

    const response = await result.current({
      paymentType: PaymentType.Lightning,
      destination: "lnbc...",
      isMerchant: false,
    })

    expect(response.saved).toBe(false)
    expect(mockContactCreate).not.toHaveBeenCalled()
  })

  it("should not save contact when destination is not a valid lightning address", async () => {
    const { result } = renderHook(() => useSaveLnAddressContact())

    const response = await result.current({
      paymentType: PaymentType.Lnurl,
      destination: "invalid-destination",
      isMerchant: false,
    })

    expect(response.saved).toBe(false)
    expect(mockContactCreate).not.toHaveBeenCalled()
  })

  describe("self-custodial branch (Important #6)", () => {
    it("saves the contact through the bridge when sdk is available", async () => {
      mockIsSelfCustodial = true
      mockSdk = { id: "sdk" }
      mockBridgeFindOrCreateContact.mockResolvedValue(undefined)

      const { result } = renderHook(() => useSaveLnAddressContact())

      const response = await result.current({
        paymentType: PaymentType.Lnurl,
        destination: "alice@spark.tips",
        isMerchant: false,
      })

      expect(response).toEqual({ saved: true, handle: "alice@spark.tips" })
      expect(mockBridgeFindOrCreateContact).toHaveBeenCalledWith(
        mockSdk,
        "alice@spark.tips",
        "alice@spark.tips",
      )
      expect(mockContactCreate).not.toHaveBeenCalled()
    })

    it("returns saved=false with the handle and logs to crashlytics when bridgeFindOrCreateContact rejects (silent swallow)", async () => {
      mockIsSelfCustodial = true
      mockSdk = { id: "sdk" }
      mockBridgeFindOrCreateContact.mockRejectedValue(new Error("contact upsert failed"))

      const { result } = renderHook(() => useSaveLnAddressContact())

      const response = await result.current({
        paymentType: PaymentType.Lnurl,
        destination: "alice@spark.tips",
        isMerchant: false,
      })

      expect(response).toEqual({ saved: false, handle: "alice@spark.tips" })
      expect(mockCrashlyticsLog).toHaveBeenCalledWith(
        expect.stringContaining("alice@spark.tips"),
      )
      expect(mockContactCreate).not.toHaveBeenCalled()
    })

    it("returns saved=false without a handle when sdk is null (no bridge call, no Apollo fallback)", async () => {
      mockIsSelfCustodial = true
      mockSdk = null

      const { result } = renderHook(() => useSaveLnAddressContact())

      const response = await result.current({
        paymentType: PaymentType.Lnurl,
        destination: "alice@spark.tips",
        isMerchant: false,
      })

      expect(response).toEqual({ saved: false })
      expect(mockBridgeFindOrCreateContact).not.toHaveBeenCalled()
      expect(mockContactCreate).not.toHaveBeenCalled()
    })

    it("does not call the Apollo mutation when self-custodial is active even on the happy path", async () => {
      mockIsSelfCustodial = true
      mockSdk = { id: "sdk" }
      mockBridgeFindOrCreateContact.mockResolvedValue(undefined)

      const { result } = renderHook(() => useSaveLnAddressContact())

      await result.current({
        paymentType: PaymentType.Lnurl,
        destination: "user@blink.sv",
        isMerchant: false,
      })

      expect(mockContactCreate).not.toHaveBeenCalled()
    })
  })
})
