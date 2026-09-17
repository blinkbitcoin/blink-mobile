import React, { useMemo } from "react"

import { ErrorMsgBottomSheet } from "@app/components/error-msg-bottom-sheet"
import { useI18nContext } from "@app/i18n/i18n-react"

import { useDismissibleErrorMsg } from "../hooks/use-dismissible-error-msg"

/** An invoice request on Next that failed: `canRetry` is false when retrying is unsafe. */
export type LnurlInvoiceError = { message: string; canRetry: boolean }

type Props = {
  lnurlError: LnurlInvoiceError | undefined
  /** The daily-limit message while the amount is over the limit (A3). */
  limitMessage: string | undefined
  onRetry: (() => void) | undefined
  onChangeAmount: () => void
}

/**
 * The error message sheet on amount entry (blink-wip#1275), opened on top of the inline
 * error, which stays. Rulings 2026-09-17:
 * - L1/L2, the recipient didn't answer: Try again repeats Next
 * - L3, the recipient sent an invoice for the wrong amount: Close only
 * - A3, over the daily limit: Change amount empties the amount here. It opens by itself on
 *   crossing the limit, stays closed while the amount stays over, and opens again on the
 *   next crossing
 */
export const AmountEntryErrorSheet: React.FC<Props> = ({
  lnurlError,
  limitMessage,
  onRetry,
  onChangeAmount,
}) => {
  const { LL } = useI18nContext()

  // Same text for as long as the amount stays over, so the same error by identity.
  const limitError = useMemo(
    () => (limitMessage ? { message: limitMessage } : undefined),
    [limitMessage],
  )

  const sheet = useDismissibleErrorMsg<{ message: string; canRetry?: boolean }>(
    lnurlError ?? limitError,
  )
  const shown = sheet.shown

  const button = (() => {
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
      title={LL.SendBitcoinScreen.problemSheetTitle()}
      body={shown?.message ?? ""}
      {...button}
      testID="amount-entry-error-msg-bottom-sheet"
    />
  )
}
