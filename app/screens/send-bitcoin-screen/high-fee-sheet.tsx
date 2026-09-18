import React from "react"

import { ErrorMsgBottomSheet } from "@app/components/error-msg-bottom-sheet"
import { useI18nContext } from "@app/i18n/i18n-react"

import { useReviewExits } from "./hooks/use-review-exits"

type Props = {
  isVisible: boolean
  /** The fee in the display currency, as the accept button names it. */
  fee: string
  onAccept: () => void
  onClose: () => void
}

/**
 * The high-fee warning (blink-wip#1323): the fee is 50% or more of the amount sent. Cancel
 * is the primary action, since a fee that size is more likely a mistake than a choice
 * (#2799), and it starts the send over with nothing entered.
 */
export const HighFeeSheet: React.FC<Props> = ({ isVisible, fee, onAccept, onClose }) => {
  const { LL } = useI18nContext()
  const { startOver } = useReviewExits()

  return (
    <ErrorMsgBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      title={LL.SendBitcoinScreen.highFeeSheet.title()}
      body={LL.SendBitcoinScreen.highFeeSheet.body()}
      primaryLabel={LL.SendBitcoinScreen.highFeeSheet.cancelPayment()}
      onPrimaryPress={startOver}
      secondaryLabel={LL.SendBitcoinScreen.highFeeSheet.acceptFee({ fee })}
      onSecondaryPress={onAccept}
      testID="high-fee-sheet"
    />
  )
}
