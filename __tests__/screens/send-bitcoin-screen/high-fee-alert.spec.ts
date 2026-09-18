import { WalletCurrency } from "@app/graphql/generated"
import {
  isHighFee,
  shouldWarnAboutHighFee,
} from "@app/screens/send-bitcoin-screen/hooks/high-fee-alert"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import type {
  ConvertMoneyAmount,
  PaymentDetail,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"

/** Prices a cent at ten sats, so a cents fee and a sats fee stay tellable apart. */
const SATS_PER_CENT = 10

const convertMoneyAmount = ((amount: { amount: number; currency: WalletCurrency }) =>
  amount.currency === WalletCurrency.Usd
    ? toBtcMoneyAmount(amount.amount * SATS_PER_CENT)
    : toBtcMoneyAmount(amount.amount)) as unknown as ConvertMoneyAmount

const buildPaymentDetail = (
  paymentType: string,
  settlementSats = 100,
): PaymentDetail<WalletCurrency> =>
  ({
    paymentType,
    settlementAmount: toBtcMoneyAmount(settlementSats),
    convertMoneyAmount,
  }) as unknown as PaymentDetail<WalletCurrency>

describe("isHighFee", () => {
  const judge = (feeSats: number, amountSats = 100) =>
    isHighFee({
      fee: toBtcMoneyAmount(feeSats),
      amount: toBtcMoneyAmount(amountSats),
      convertMoneyAmount,
    })

  it("warns once the fee is over half of what is being sent", () => {
    expect(judge(60)).toBe(true)
  })

  it("warns exactly at half of what is being sent", () => {
    // 100 sats sent against a 50 sat fee: "equal or more" includes the boundary.
    expect(judge(50)).toBe(true)
  })

  it("stays quiet just under half", () => {
    expect(judge(49)).toBe(false)
  })

  it("stays quiet while the fee is a small share of the amount", () => {
    expect(judge(10)).toBe(false)
  })

  it("never warns about a free send", () => {
    expect(judge(0, 0)).toBe(false)
  })

  it("converts a cents fee before weighing it against a sats amount", () => {
    // 6 cents is 60 sats here; read as 6 sats it would look harmless.
    expect(
      isHighFee({
        fee: toUsdMoneyAmount(6),
        amount: toBtcMoneyAmount(100),
        convertMoneyAmount,
      }),
    ).toBe(true)
  })
})

describe("shouldWarnAboutHighFee", () => {
  const judge = (params: Partial<Parameters<typeof shouldWarnAboutHighFee>[0]> = {}) =>
    shouldWarnAboutHighFee({
      paymentDetail: buildPaymentDetail("onchain"),
      selectedTierFee: toBtcMoneyAmount(60),
      hasFeeQuote: true,
      ...params,
    })

  it("warns on an on-chain send whose picked tier costs half or more", () => {
    expect(judge()).toBe(true)
  })

  it("stays quiet until the picked tier has been quoted", () => {
    // The fee on hand is a zeroed placeholder, so there is nothing to judge.
    expect(judge({ hasFeeQuote: false })).toBe(false)
  })

  it("leaves Lightning to review, where its fee is known", () => {
    expect(judge({ paymentDetail: buildPaymentDetail("lightning") })).toBe(false)
  })

  it("stays quiet before a payment exists", () => {
    expect(judge({ paymentDetail: null })).toBe(false)
  })
})
