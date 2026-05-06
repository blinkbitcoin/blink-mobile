import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { createSelfCustodialLightningPaymentDetails } from "@app/self-custodial/payment-details/lightning"

// Spy on createGetFee / createSendMutation but delegate to the REAL
// implementations so the LIGHTNING_FEE_SATS bug (and any future regression in
// how the helpers compute fees) is no longer hidden behind bare jest.fn() stubs.
const mockCreateGetFee = jest.fn()
const mockCreateSendMutation = jest.fn()

jest.mock("@app/self-custodial/payment-details/send-helpers", () => {
  const actual = jest.requireActual("@app/self-custodial/payment-details/send-helpers")
  return {
    ...actual,
    createGetFee: (...args: unknown[]) => {
      mockCreateGetFee(...args)
      return (actual.createGetFee as (...a: unknown[]) => unknown)(...args)
    },
    createSendMutation: (...args: unknown[]) => {
      mockCreateSendMutation(...args)
      return (actual.createSendMutation as (...a: unknown[]) => unknown)(...args)
    },
  }
})

/* eslint-disable camelcase */
jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  PrepareSendPaymentRequest: { create: jest.fn((args: unknown) => args) },
  SendPaymentRequest: { create: jest.fn((args: unknown) => args) },
  Network: { Mainnet: 0, Regtest: 1 },
  BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
  InputType_Tags: { SparkAddress: "SparkAddress" },
  OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
  SendPaymentMethod_Tags: {
    BitcoinAddress: "BitcoinAddress",
    Bolt11Invoice: "Bolt11Invoice",
  },
  SendPaymentOptions: {
    BitcoinAddress: jest.fn().mockImplementation((args: unknown) => args),
  },
}))
/* eslint-enable camelcase */

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { tokenIdentifier: "usdb-token-id" },
  SparkToken: { Label: "USDB", Ticker: "USDB", DefaultDecimals: 6 },
}))

const createParams = (overrides = {}) => ({
  sdk: {} as never,
  paymentRequest: "lnbc1...",
  unitOfAccountAmount: {
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  },
  hasAmount: true,
  convertMoneyAmount: jest.fn().mockReturnValue({
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  }),
  sendingWalletDescriptor: { id: "w1", currency: WalletCurrency.Btc },
  ...overrides,
})

describe("createSelfCustodialLightningPaymentDetails", () => {
  beforeEach(() => {
    mockCreateGetFee.mockClear()
    mockCreateSendMutation.mockClear()
  })

  it("returns Lightning payment type", () => {
    const detail = createSelfCustodialLightningPaymentDetails(createParams())
    expect(detail.paymentType).toBe(PaymentType.Lightning)
  })

  it("sets destination to paymentRequest", () => {
    const detail = createSelfCustodialLightningPaymentDetails(createParams())
    expect(detail.destination).toBe("lnbc1...")
  })

  it("cannot set amount when hasAmount=true", () => {
    const detail = createSelfCustodialLightningPaymentDetails(
      createParams({ hasAmount: true }),
    )
    expect(detail.canSetAmount).toBe(false)
  })

  it("can set amount when hasAmount=false", () => {
    const detail = createSelfCustodialLightningPaymentDetails(
      createParams({ hasAmount: false }),
    )
    expect(detail.canSetAmount).toBe(true)
  })

  it("has destinationSpecifiedAmount when hasAmount=true", () => {
    const detail = createSelfCustodialLightningPaymentDetails(
      createParams({ hasAmount: true }),
    )
    expect(detail.destinationSpecifiedAmount).toBeDefined()
  })

  it("can send and get fee when amount > 0", () => {
    const detail = createSelfCustodialLightningPaymentDetails(createParams())
    expect(detail.canSendPayment).toBe(true)
    expect(detail.canGetFee).toBe(true)
  })

  it("cannot send or get fee when amount is 0", () => {
    const detail = createSelfCustodialLightningPaymentDetails(
      createParams({
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 0,
          currency: WalletCurrency.Btc,
          currencyCode: WalletCurrency.Btc,
        }),
      }),
    )
    expect(detail.canSendPayment).toBe(false)
    expect(detail.canGetFee).toBe(false)
  })

  it("uses destinationSpecifiedMemo over senderSpecifiedMemo", () => {
    const detail = createSelfCustodialLightningPaymentDetails(
      createParams({
        destinationSpecifiedMemo: "invoice memo",
        senderSpecifiedMemo: "sender memo",
      }),
    )
    expect(detail.memo).toBe("invoice memo")
  })

  it("uses senderSpecifiedMemo when no destinationSpecifiedMemo", () => {
    const detail = createSelfCustodialLightningPaymentDetails(
      createParams({ senderSpecifiedMemo: "sender memo" }),
    )
    expect(detail.memo).toBe("sender memo")
  })

  it("cannot set memo when destinationSpecifiedMemo exists", () => {
    const detail = createSelfCustodialLightningPaymentDetails(
      createParams({ destinationSpecifiedMemo: "locked" }),
    )
    expect(detail.canSetMemo).toBe(false)
  })

  it("can set memo when no destinationSpecifiedMemo", () => {
    const detail = createSelfCustodialLightningPaymentDetails(createParams())
    expect(detail.canSetMemo).toBe(true)
  })

  it("setMemo returns new detail with updated memo", () => {
    const detail = createSelfCustodialLightningPaymentDetails(createParams())
    if (detail.canSetMemo && detail.setMemo) {
      const updated = detail.setMemo("new memo")
      expect(updated.memo).toBe("new memo")
    }
  })

  it("setAmount returns new detail", () => {
    const detail = createSelfCustodialLightningPaymentDetails(
      createParams({ hasAmount: false }),
    )
    if (detail.canSetAmount && detail.setAmount) {
      const newAmount = {
        amount: 2000,
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      }
      const updated = detail.setAmount(newAmount)
      expect(updated.unitOfAccountAmount).toEqual(newAmount)
    }
  })

  it("setSendingWalletDescriptor returns new detail", () => {
    const detail = createSelfCustodialLightningPaymentDetails(createParams())
    const newDesc = { id: "w2", currency: WalletCurrency.Btc }
    const updated = detail.setSendingWalletDescriptor(newDesc)
    expect(updated.sendingWalletDescriptor).toEqual(newDesc)
  })

  it("setConvertMoneyAmount returns new detail", () => {
    const newConvert = jest.fn().mockReturnValue({
      amount: 500,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    })
    const detail = createSelfCustodialLightningPaymentDetails(createParams())
    const updated = detail.setConvertMoneyAmount(newConvert)
    expect(updated.convertMoneyAmount).toBe(newConvert)
  })

  it("passes USDB tokenIdentifier when sending wallet is USD", () => {
    createSelfCustodialLightningPaymentDetails(
      createParams({
        sendingWalletDescriptor: { id: "w-usd", currency: WalletCurrency.Usd },
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 500,
          currency: WalletCurrency.Usd,
          currencyCode: WalletCurrency.Usd,
        }),
      }),
    )

    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: "usdb-token-id" }),
    )
    expect(mockCreateGetFee).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: "usdb-token-id" }),
      WalletCurrency.Usd,
    )
  })

  it("passes tokenIdentifier=undefined when sending wallet is BTC", () => {
    createSelfCustodialLightningPaymentDetails(createParams())

    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: undefined }),
    )
    expect(mockCreateGetFee).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: undefined }),
      WalletCurrency.Btc,
    )
  })

  it("scales USD settlement cents into USDB base units for hasAmount=false", () => {
    createSelfCustodialLightningPaymentDetails(
      createParams({
        hasAmount: false,
        sendingWalletDescriptor: { id: "w-usd", currency: WalletCurrency.Usd },
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 70,
          currency: WalletCurrency.Usd,
          currencyCode: WalletCurrency.Usd,
        }),
      }),
    )

    // 70 cents ($0.70) × 10^4 (USDB 6-decimal scaling vs 2-decimal display) = 700_000 base units
    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BigInt(700000) }),
    )
  })

  it("keeps BTC settlement amount in sats for hasAmount=false", () => {
    createSelfCustodialLightningPaymentDetails(
      createParams({
        hasAmount: false,
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 12345,
          currency: WalletCurrency.Btc,
          currencyCode: WalletCurrency.Btc,
        }),
      }),
    )

    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BigInt(12345) }),
    )
  })
})
