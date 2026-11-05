import React, { useMemo } from "react"

import { ErrorMsgBottomSheet } from "@app/components/error-msg-bottom-sheet"
import { useI18nContext } from "@app/i18n/i18n-react"

import { useDismissibleErrorMsg } from "../hooks/use-dismissible-error-msg"
import { useReviewExits } from "../hooks/use-review-exits"

/** An invoice request on Next that failed: `canRetry` is false when retrying is unsafe. */
export type LnurlInvoiceError = { title: string; message: string; canRetry: boolean }

type Props = {
  lnurlError: LnurlInvoiceError | undefined
  /** The daily-limit message while the amount is over the limit (A3). */
  limitMessage: string | undefined
  /** The on-chain address is the sending wallet's own (blink-mobile#4261). */
  selfPaymentMessage: string | undefined
  /** The daily limit could not be read, so nothing may go on until it is: Try again reads
   *  it again. */
  onRetryLimits: (() => void) | undefined
  onRetry: (() => void) | undefined
  onChangeAmount: () => void
}

/**
 * The error message sheet on amount entry (blink-wip#1275), opened on top of the inline
 * error, which stays. Rulings 2026-09-17:
 * - L1/L2, "Couldn't reach the recipient": Try again repeats Next
 * - L3, "Recipient sent the wrong amount": Close only
 * - A3, over the daily limit: Change amount empties the amount here. It opens by itself on
 *   crossing the limit, stays closed while the amount stays over, and opens again on the
 *   next crossing
 * - the daily limit could not be read: Try again reads it again. Next stays off meanwhile,
 *   since a limit nobody checked is not one the amount passed
 * - an on-chain address of the sending wallet (blink-mobile#4261): Change destination
 *   starts the send over, since no amount or wallet on this screen can fix it
 */
export const AmountEntryErrorSheet: React.FC<Props> = ({
  lnurlError,
  limitMessage,
  selfPaymentMessage,
  onRetryLimits,
  onRetry,
  onChangeAmount,
}) => {
  const { LL } = useI18nContext()
  const { startOver } = useReviewExits()

  // Same text for as long as the amount stays over, so the same error by identity.
  const limitError = useMemo(
    () => (limitMessage ? { message: limitMessage } : undefined),
    [limitMessage],
  )

  const hasLimitsError = Boolean(onRetryLimits)
  const limitsError = useMemo(
    () =>
      hasLimitsError
        ? { message: LL.SendBitcoinScreen.limitsUnavailable(), isLimitsError: true }
        : undefined,
    [hasLimitsError, LL],
  )

  // Held while the address stays the same, so a new amount doesn't open it again.
  const selfPaymentError = useMemo(
    () =>
      selfPaymentMessage
        ? { message: selfPaymentMessage, isSelfPayment: true }
        : undefined,
    [selfPaymentMessage],
  )

  const sheet = useDismissibleErrorMsg<{
    title?: string
    message: string
    canRetry?: boolean
    isLimitsError?: boolean
    isSelfPayment?: boolean
  }>(lnurlError ?? limitsError ?? limitError ?? selfPaymentError)
  const shown = sheet.shown

  const button = (() => {
    if (shown?.isLimitsError && onRetryLimits) {
      return {
        primaryLabel: LL.SendBitcoinConfirmationScreen.tryAgain(),
        onPrimaryPress: () => {
          sheet.dismiss()
          onRetryLimits()
        },
      }
    }
    if (shown?.isSelfPayment) {
      return {
        primaryLabel: LL.SendBitcoinScreen.changeDestination(),
        onPrimaryPress: () => {
          sheet.dismiss()
          startOver()
        },
      }
    }
    if (shown && "canRetry" in shown) {
      return shown.canRetry && onRetry
        ? {
            primaryLabel: LL.SendBitcoinConfirmationScreen.tryAgain(),
            onPrimaryPress: () => {
              sheet.dismiss()
              onRetry()
            },
          }
        : { primaryLabel: LL.common.close(), onPrimaryPress: sheet.dismiss }
    }
    return {
      primaryLabel: LL.SendBitcoinConfirmationScreen.changeAmount(),
      onPrimaryPress: () => {
        sheet.dismiss()
        onChangeAmount()
      },
    }
  })()

  // Mounted all along and only toggled, as `BottomSheet` expects; with no error it is hidden.
  return (
    <ErrorMsgBottomSheet
      isVisible={sheet.isVisible}
      onClose={sheet.dismiss}
      title={shown?.title ?? LL.SendBitcoinScreen.problemSheetTitle()}
      body={shown?.message ?? ""}
      {...button}
      testID="amount-entry-error-msg-bottom-sheet"
    />
  )
}
