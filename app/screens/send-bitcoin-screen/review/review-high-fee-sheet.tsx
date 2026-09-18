import React from "react"

import { WalletCurrency } from "@app/graphql/generated"

import { HighFeeSheet } from "../high-fee-sheet"
import { isHighFee } from "../hooks/high-fee-alert"
import { useDismissibleErrorMsg } from "../hooks/use-dismissible-error-msg"
import type { PaymentDetail } from "../payment-details/index.types"
import type useFee from "../use-fee"

type Props = {
  paymentDetail: PaymentDetail<WalletCurrency>
  fee: ReturnType<typeof useFee>
  /** The fee in the display currency. */
  feeText: string
  /** Something blocks the send, or it is under way: either is told before a warning. */
  isBlocked: boolean
}

/**
 * The high-fee warning on review (blink-wip#1323). Lightning's fee is only known here, so
 * its warning opens once the quote lands. On-chain was warned on amount entry, where its
 * tier was quoted. The quote itself is the error, so a new quote warns again and a
 * dismissed one stays dismissed. Accepting only closes the sheet: the slider sends.
 */
export const ReviewHighFeeSheet: React.FC<Props> = ({
  paymentDetail: { paymentType, settlementAmount, convertMoneyAmount },
  fee,
  feeText,
  isBlocked,
}) => {
  const sheet = useDismissibleErrorMsg(
    paymentType !== "onchain" &&
      fee.status === "set" &&
      isHighFee({ fee: fee.amount, amount: settlementAmount, convertMoneyAmount })
      ? fee
      : undefined,
  )

  return (
    <HighFeeSheet
      isVisible={sheet.isVisible && !isBlocked}
      fee={feeText}
      onAccept={sheet.dismiss}
      onClose={sheet.dismiss}
    />
  )
}
