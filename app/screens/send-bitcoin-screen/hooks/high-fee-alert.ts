import { PaymentType } from "@blinkbitcoin/blink-client"

import { WalletCurrency } from "@app/graphql/generated"
import { type WalletAmount } from "@app/types/amounts"

import type { ConvertMoneyAmount, PaymentDetail } from "../payment-details/index.types"

/** Warn once the fee reaches half of what is being sent. */
const RATIO_FEES_TO_AMOUNT = 2

/** Below this a send is small enough that any fee is a large share of it: no warning. */
const MIN_WARNED_AMOUNT_SATS = 100

type HighFeeParams = {
  fee: WalletAmount<WalletCurrency>
  /** What the recipient gets, fee excluded. */
  amount: WalletAmount<WalletCurrency>
  convertMoneyAmount: ConvertMoneyAmount
}

/**
 * Whether the fee is 50% or more of the amount sent (blink-wip#1323), on any rail. Both
 * are weighed in sats, so a cents fee is not rounded against a cents amount. A free send
 * is never high, and neither is one under 100 sats, whatever its fee.
 */
export const isHighFee = ({ fee, amount, convertMoneyAmount }: HighFeeParams) => {
  const feeInSats = convertMoneyAmount(fee, WalletCurrency.Btc)
  if (feeInSats.amount <= 0) return false

  const sendingInSats = convertMoneyAmount(amount, WalletCurrency.Btc)
  if (sendingInSats.amount < MIN_WARNED_AMOUNT_SATS) return false

  return feeInSats.amount * RATIO_FEES_TO_AMOUNT >= sendingInSats.amount
}

type OnchainFeeAlertParams = {
  paymentDetail: PaymentDetail<WalletCurrency> | null
  /** The fee the selector is showing for the picked tier, in the sending wallet's unit. */
  selectedTierFee: WalletAmount<WalletCurrency>
  hasFeeQuote: boolean
}

/**
 * The on-chain warning on amount entry, where the picked tier's fee is already quoted.
 * Lightning's fee is only known on review, so it is judged there.
 *
 * Reads the fee the selector already quoted rather than probing a going rate of its own.
 * The three tiers arrive together, so switching speed leaves no window where the warning
 * judges one queue by another's rate, and the payment is measured by its own fee rather
 * than by a fixed-size proxy.
 */
export const shouldWarnAboutHighFee = ({
  paymentDetail,
  selectedTierFee,
  hasFeeQuote,
}: OnchainFeeAlertParams) => {
  // Nothing quoted is nothing to judge: the fee on hand is a zeroed placeholder.
  if (paymentDetail?.paymentType !== PaymentType.Onchain || !hasFeeQuote) return false

  return isHighFee({
    fee: selectedTierFee,
    amount: paymentDetail.settlementAmount,
    convertMoneyAmount: paymentDetail.convertMoneyAmount,
  })
}
