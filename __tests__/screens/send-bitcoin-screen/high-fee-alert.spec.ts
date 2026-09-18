import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { shouldWarnAboutHighFee } from "@app/screens/send-bitcoin-screen/hooks/onchain-fee-alert"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import type { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"

/** Prices a cent at ten sats, so a cents fee and a sats fee stay tellable apart. */
const SATS_PER_CENT = 10

const buildOnchainPaymentDetail = (settlementSats = 100): PaymentDetail<WalletCurrency> =>
  ({
    paymentType: "onchain",
    settlementAmount: toBtcMoneyAmount(settlementSats),
    convertMoneyAmount: (amount: { amount: number; currency: WalletCurrency }) =>
      amount.currency === WalletCurrency.Usd
        ? toBtcMoneyAmount(amount.amount * SATS_PER_CENT)
        : toBtcMoneyAmount(amount.amount),
  }) as unknown as PaymentDetail<WalletCurrency>

const renderAlert = (
  params: Partial<Parameters<typeof shouldWarnAboutHighFee>[0]> = {},
) =>
  renderHook(() =>
    shouldWarnAboutHighFee({
      paymentDetail: buildOnchainPaymentDetail(100),
      isSelfCustodial: false,
      selectedTierFee: toBtcMoneyAmount(10),
      hasFeeQuote: true,
      ...params,
    }),
  )

describe("shouldWarnAboutHighFee", () => {
  it("warns once the fee reaches half of what is being sent", () => {
    // 100 sats sent against a 60 sat fee: the fee is over half the amount.
    const { result } = renderAlert({ selectedTierFee: toBtcMoneyAmount(60) })

    expect(result.current).toBe(true)
  })

  it("stays quiet while the fee is a small share of the amount", () => {
    const { result } = renderAlert({ selectedTierFee: toBtcMoneyAmount(10) })

    expect(result.current).toBe(false)
  })

  it("stays quiet exactly at the threshold", () => {
    // 100 sats sent against a 50 sat fee is the boundary, not past it.
    const { result } = renderAlert({ selectedTierFee: toBtcMoneyAmount(50) })

    expect(result.current).toBe(false)
  })

  it("converts a cents fee before weighing it against a sats amount", () => {
    // 6 cents is 60 sats here; read as 6 sats it would look harmless.
    const { result } = renderAlert({ selectedTierFee: toUsdMoneyAmount(6) })

    expect(result.current).toBe(true)
  })

  it("stays quiet until the picked tier has been quoted", () => {
    const { result } = renderAlert({
      selectedTierFee: toBtcMoneyAmount(60),
      hasFeeQuote: false,
    })

    // The fee on hand is a zeroed placeholder, so there is nothing to judge.
    expect(result.current).toBe(false)
  })

  it("leaves the warning to the SDK on a self-custodial send", () => {
    const { result } = renderAlert({
      isSelfCustodial: true,
      selectedTierFee: toBtcMoneyAmount(60),
    })

    expect(result.current).toBe(false)
  })

  it("stays quiet when the payment is not on-chain", () => {
    const lightning = {
      ...buildOnchainPaymentDetail(100),
      paymentType: "lightning",
    } as unknown as PaymentDetail<WalletCurrency>

    const { result } = renderAlert({
      paymentDetail: lightning,
      selectedTierFee: toBtcMoneyAmount(60),
    })

    expect(result.current).toBe(false)
  })

  it("stays quiet before a payment exists", () => {
    const { result } = renderAlert({
      paymentDetail: null,
      selectedTierFee: toBtcMoneyAmount(60),
    })

    expect(result.current).toBe(false)
  })
})
