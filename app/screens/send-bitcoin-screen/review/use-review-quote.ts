import { useCallback, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { subtractMoneyAmounts } from "@app/types/amounts"
import { toastShow } from "@app/utils/toast"

import { PaymentDetail } from "../payment-details/index.types"
import useFee from "../use-fee"

/**
 * The quote review stands on.
 *
 * When the fee comes out of the amount, the recipient gets the amount less the fee, so
 * that is the amount review leads with, and nothing is sent until the fee is quoted. The
 * custodial on-chain send-all sets `isFeeIncluded`, since its mutation pays the fee out of
 * the balance, and so do the self-custodial Bitcoin wallet's send-alls: on-chain, Spark, a
 * Lightning invoice with no amount, and LNURL or a Lightning address.
 *
 * Such a send is quoted again at the slide, and one whose quote moved since review is
 * never sent (blink-wip#2048 E4): `requote` fetches a new one, and a toast asks the
 * sender to look at the new amounts.
 */
export const useReviewQuote = (paymentDetail: PaymentDetail<WalletCurrency>) => {
  const { LL } = useI18nContext()
  const [quoteRound, setQuoteRound] = useState(0)
  const fee = useFee(paymentDetail.getFee, quoteRound)

  const requote = useCallback(() => {
    toastShow({
      message: (translations) =>
        translations.SendBitcoinConfirmationScreen.priceUpdated(),
      LL,
      type: "warning",
    })
    setQuoteRound((round) => round + 1)
  }, [LL])

  const { settlementAmount, isFeeIncluded, convertMoneyAmount } = paymentDetail
  const lessFee =
    isFeeIncluded && fee.status === "set"
      ? subtractMoneyAmounts({
          a: settlementAmount,
          b: convertMoneyAmount(fee.amount, settlementAmount.currency),
        })
      : undefined
  /** A fee that would take the whole amount leaves the recipient nothing: no send, and
   *  never a negative amount on review. */
  const isFeeOverAmount = lessFee !== undefined && lessFee.amount <= 0
  const recipientAmount = lessFee
    ? { ...lessFee, amount: Math.max(lessFee.amount, 0) }
    : settlementAmount

  return {
    fee,
    recipientAmount,
    isAwaitingIncludedFee: Boolean(isFeeIncluded) && fee.status !== "set",
    isFeeOverAmount,
    requote,
  }
}
