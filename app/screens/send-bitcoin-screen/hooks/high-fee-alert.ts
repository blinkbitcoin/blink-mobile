import { PaymentType } from "@blinkbitcoin/blink-client"

import { WalletCurrency } from "@app/graphql/generated"
import { type WalletAmount } from "@app/types/amounts"

import type { PaymentDetail } from "../payment-details/index.types"

/** Warn once the fee climbs past half of what is being sent. */
const RATIO_FEES_TO_AMOUNT = 2

type OnchainFeeAlertParams = {
  paymentDetail: PaymentDetail<WalletCurrency> | null
  isSelfCustodial: boolean
  /** The fee the selector is showing for the picked tier, in the sending wallet's unit. */
  selectedTierFee: WalletAmount<WalletCurrency>
  hasFeeQuote: boolean
}

/**
 * Reads the fee the selector already quoted rather than probing a going rate of its own.
 * The three tiers arrive together, so switching speed leaves no window where the warning
 * judges one queue by another's rate, and the payment is measured by its own fee rather
 * than by a fixed-size proxy.
 */
export const shouldWarnAboutHighFee = ({
  paymentDetail,
  isSelfCustodial,
  selectedTierFee,
  hasFeeQuote,
}: OnchainFeeAlertParams) => {
  const isOnchain = paymentDetail?.paymentType === PaymentType.Onchain
  const isCustodialOnchain = !isSelfCustodial && isOnchain

  // Nothing quoted is nothing to judge: the fee on hand is a zeroed placeholder.
  if (!isCustodialOnchain || !hasFeeQuote) return false

  const { convertMoneyAmount } = paymentDetail
  const feeInSats = convertMoneyAmount(selectedTierFee, WalletCurrency.Btc)
  const sendingInSats = convertMoneyAmount(
    paymentDetail.settlementAmount,
    WalletCurrency.Btc,
  )

  return sendingInSats.amount < feeInSats.amount * RATIO_FEES_TO_AMOUNT
}
