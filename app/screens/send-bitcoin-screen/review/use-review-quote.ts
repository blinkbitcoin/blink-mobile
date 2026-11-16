import { WalletCurrency } from "@app/graphql/generated"
import { subtractMoneyAmounts } from "@app/types/amounts"

import { PaymentDetail } from "../payment-details/index.types"
import useFee from "../use-fee"

/**
 * The quote review stands on.
 *
 * When the fee comes out of the amount, the recipient gets the amount less the fee, so
 * that is the amount review leads with, and nothing is sent until the fee is quoted. No
 * payment sets `isFeeIncluded` yet: what is taken out of an amount is left to the senior
 * dev (blink-wip#1134, logic rule).
 */
export const useReviewQuote = (paymentDetail: PaymentDetail<WalletCurrency>) => {
  const fee = useFee(paymentDetail.getFee)

  const { settlementAmount, isFeeIncluded, convertMoneyAmount } = paymentDetail
  const recipientAmount =
    isFeeIncluded && fee.status === "set"
      ? subtractMoneyAmounts({
          a: settlementAmount,
          b: convertMoneyAmount(fee.amount, settlementAmount.currency),
        })
      : settlementAmount

  return {
    fee,
    recipientAmount,
    isAwaitingIncludedFee: Boolean(isFeeIncluded) && fee.status !== "set",
  }
}
