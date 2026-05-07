import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { wrapDestination } from "@app/self-custodial/payment-details/wrap-destination"

const mockCreateLightning = jest.fn().mockReturnValue({ paymentType: "lightning" })
const mockCreateOnchain = jest.fn().mockReturnValue({ paymentType: "onchain" })

jest.mock("@app/self-custodial/payment-details/lightning", () => ({
  createSelfCustodialLightningPaymentDetails: (...args: unknown[]) =>
    mockCreateLightning(...args),
}))

jest.mock("@app/self-custodial/payment-details/onchain", () => ({
  createSelfCustodialOnchainPaymentDetails: (...args: unknown[]) =>
    mockCreateOnchain(...args),
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

  it("wraps Lnurl destination", () => {
    const result = createValidResult(PaymentType.Lnurl, {
      lnurl: "lnurl1...",
    })

    const wrapped = wrapDestination(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateLightning).toHaveBeenCalledWith(
      expect.objectContaining({ paymentRequest: "lnurl1..." }),
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
