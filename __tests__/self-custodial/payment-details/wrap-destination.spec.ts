import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { wrapDestination } from "@app/self-custodial/payment-details/wrap-destination"

const mockCreateLightning = jest.fn().mockReturnValue({ paymentType: "lightning" })
const mockCreateOnchain = jest.fn().mockReturnValue({ paymentType: "onchain" })
const mockCreateLnurl = jest.fn().mockReturnValue({ paymentType: "lnurl" })

jest.mock("@app/self-custodial/payment-details/lightning", () => ({
  createSelfCustodialLightningPaymentDetails: (...args: unknown[]) =>
    mockCreateLightning(...args),
}))

jest.mock("@app/self-custodial/payment-details/onchain", () => ({
  createSelfCustodialOnchainPaymentDetails: (...args: unknown[]) =>
    mockCreateOnchain(...args),
}))

jest.mock("@app/self-custodial/payment-details/lnurl", () => ({
  createSelfCustodialLnurlPaymentDetails: (...args: unknown[]) =>
    mockCreateLnurl(...args),
}))

const mockSdk = {} as never

const createValidResult = (paymentType: PaymentType, extra = {}) =>
  ({
    valid: true,
    destinationDirection: "Send",
    validDestination: { paymentType, ...extra },
    createPaymentDetail: jest.fn().mockReturnValue({ paymentType: "original" }),
  }) as never

const createParams = () => ({
  convertMoneyAmount: jest.fn(),
  sendingWalletDescriptor: { id: "w1", currency: WalletCurrency.Btc },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callCreatePaymentDetail = (wrapped: any) =>
  wrapped.createPaymentDetail(createParams())

describe("wrapDestination", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns result as-is when invalid", () => {
    const result = { valid: false as const } as never
    expect(wrapDestination(result, mockSdk)).toBe(result)
  })

  it("returns result as-is when direction is Receive", () => {
    const result = {
      valid: true,
      destinationDirection: "Receive",
      validDestination: { paymentType: PaymentType.Lightning },
      createPaymentDetail: jest.fn(),
    } as never
    expect(wrapDestination(result, mockSdk)).toBe(result)
  })

  it("wraps Lightning destination", () => {
    const result = createValidResult(PaymentType.Lightning, {
      paymentRequest: "lnbc1...",
      amount: 1000,
    })

    const wrapped = wrapDestination(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateLightning).toHaveBeenCalledWith(
      expect.objectContaining({
        sdk: mockSdk,
        paymentRequest: "lnbc1...",
        hasAmount: true,
      }),
    )
  })

  it("wraps Lightning with zero amount as hasAmount=false", () => {
    const result = createValidResult(PaymentType.Lightning, {
      paymentRequest: "lnbc1...",
      amount: 0,
    })

    const wrapped = wrapDestination(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateLightning).toHaveBeenCalledWith(
      expect.objectContaining({ hasAmount: false }),
    )
  })

  it("wraps Lnurl destination through the SC lnurl detail (not the lightning detail)", () => {
    const result = createValidResult(PaymentType.Lnurl, {
      lnurl: "lnurl1...",
      isMerchant: false,
      lnurlParams: {
        callback: "https://example.com/cb",
        min: 1,
        max: 1000,
        commentAllowed: 200,
        description: "Pay user",
      },
    })

    const wrapped = wrapDestination(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateLnurl).toHaveBeenCalledWith(
      expect.objectContaining({
        sdk: mockSdk,
        lnurl: "lnurl1...",
        isMerchant: false,
        destinationSpecifiedMemo: "Pay user",
        lnurlParams: expect.objectContaining({ min: 1, max: 1000 }),
      }),
    )
    expect(mockCreateLightning).not.toHaveBeenCalled()
  })

  it("falls back to 0 sats when lnurlParams.min is undefined (still has callback + max)", () => {
    const result = createValidResult(PaymentType.Lnurl, {
      lnurl: "lnurl1nomin",
      isMerchant: false,
      lnurlParams: {
        callback: "https://example.com/cb",
        max: 1000,
        commentAllowed: 0,
      },
    })

    const wrapped = wrapDestination(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateLnurl).toHaveBeenCalledWith(
      expect.objectContaining({
        unitOfAccountAmount: expect.objectContaining({ amount: 0 }),
      }),
    )
  })

  it("propagates isMerchant=true for merchant Lnurl destinations", () => {
    const result = createValidResult(PaymentType.Lnurl, {
      lnurl: "lnurl1merchant",
      isMerchant: true,
      lnurlParams: {
        callback: "https://m.example/cb",
        min: 1,
        max: 100,
        commentAllowed: 0,
      },
    })

    const wrapped = wrapDestination(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateLnurl).toHaveBeenCalledWith(
      expect.objectContaining({ isMerchant: true }),
    )
  })

  it("wraps Onchain destination", () => {
    const result = createValidResult(PaymentType.Onchain, {
      address: "bc1q...",
    })

    const wrapped = wrapDestination(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateOnchain).toHaveBeenCalledWith(
      expect.objectContaining({
        sdk: mockSdk,
        address: "bc1q...",
      }),
    )
  })

  it("falls back to original createPaymentDetail for other types", () => {
    const originalCreatePaymentDetail = jest
      .fn()
      .mockReturnValue({ paymentType: "original" })
    const result = {
      valid: true,
      destinationDirection: "Send",
      validDestination: { paymentType: PaymentType.Intraledger },
      createPaymentDetail: originalCreatePaymentDetail,
    } as never

    const wrapped = wrapDestination(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(originalCreatePaymentDetail).toHaveBeenCalled()
    expect(mockCreateLightning).not.toHaveBeenCalled()
    expect(mockCreateOnchain).not.toHaveBeenCalled()
  })
})
