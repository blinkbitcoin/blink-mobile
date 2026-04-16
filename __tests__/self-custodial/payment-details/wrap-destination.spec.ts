import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { wrapDestinationForSC } from "@app/self-custodial/payment-details/wrap-destination"

const mockCreateSCLightning = jest.fn().mockReturnValue({ paymentType: "lightning" })
const mockCreateSCOnchain = jest.fn().mockReturnValue({ paymentType: "onchain" })

jest.mock("@app/self-custodial/payment-details/lightning", () => ({
  createSCLightningPaymentDetails: (...args: unknown[]) => mockCreateSCLightning(...args),
}))

jest.mock("@app/self-custodial/payment-details/onchain", () => ({
  createSCOnchainPaymentDetails: (...args: unknown[]) => mockCreateSCOnchain(...args),
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

describe("wrapDestinationForSC", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns result as-is when invalid", () => {
    const result = { valid: false as const } as never
    expect(wrapDestinationForSC(result, mockSdk)).toBe(result)
  })

  it("returns result as-is when direction is Receive", () => {
    const result = {
      valid: true,
      destinationDirection: "Receive",
      validDestination: { paymentType: PaymentType.Lightning },
      createPaymentDetail: jest.fn(),
    } as never
    expect(wrapDestinationForSC(result, mockSdk)).toBe(result)
  })

  it("wraps Lightning destination", () => {
    const result = createValidResult(PaymentType.Lightning, {
      paymentRequest: "lnbc1...",
      amount: 1000,
    })

    const wrapped = wrapDestinationForSC(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateSCLightning).toHaveBeenCalledWith(
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

    const wrapped = wrapDestinationForSC(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateSCLightning).toHaveBeenCalledWith(
      expect.objectContaining({ hasAmount: false }),
    )
  })

  it("wraps Lnurl destination", () => {
    const result = createValidResult(PaymentType.Lnurl, {
      lnurl: "lnurl1...",
    })

    const wrapped = wrapDestinationForSC(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateSCLightning).toHaveBeenCalledWith(
      expect.objectContaining({ paymentRequest: "lnurl1..." }),
    )
  })

  it("wraps Onchain destination", () => {
    const result = createValidResult(PaymentType.Onchain, {
      address: "bc1q...",
    })

    const wrapped = wrapDestinationForSC(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(mockCreateSCOnchain).toHaveBeenCalledWith(
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

    const wrapped = wrapDestinationForSC(result, mockSdk)
    callCreatePaymentDetail(wrapped)

    expect(originalCreatePaymentDetail).toHaveBeenCalled()
    expect(mockCreateSCLightning).not.toHaveBeenCalled()
    expect(mockCreateSCOnchain).not.toHaveBeenCalled()
  })
})
