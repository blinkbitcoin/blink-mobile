import { useMemo } from "react"

import { isSelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

import type { ErrorMsgAction, FailureOutcome } from "../error-msg-action"
import { useDismissibleErrorMsg } from "./use-dismissible-error-msg"
import { useReviewExits } from "./use-review-exits"

type ReviewError = { message: string; action: ErrorMsgAction }

type Args = {
  /** The send failure on show, if any. */
  paymentFailure: ReviewError | undefined
  isFeeFailed: boolean
  feeErrorCode: string | undefined
  feeErrorText: string
  errorMsgActionFor: (raw: string | undefined, outcome?: FailureOutcome) => ErrorMsgAction
}

/**
 * The error message sheet on review (blink-wip#1278), opened on top of the inline error.
 *
 * A send failure takes the sheet. Otherwise a self-custodial fee quote that failed with a
 * classified code does (R2): nothing has been sent then, so its action can never pay twice.
 * Custodial fee failures carry raw text and stay inline.
 */
export const useReviewErrorSheet = ({
  paymentFailure,
  isFeeFailed,
  feeErrorCode,
  feeErrorText,
  errorMsgActionFor,
}: Args) => {
  const exits = useReviewExits()

  const feeError = useMemo(
    () =>
      isFeeFailed && isSelfCustodialErrorCode(feeErrorCode)
        ? {
            message: feeErrorText,
            action: errorMsgActionFor(feeErrorCode, "notSent"),
          }
        : undefined,
    [isFeeFailed, feeErrorCode, feeErrorText, errorMsgActionFor],
  )

  const sheet = useDismissibleErrorMsg(paymentFailure ?? feeError)

  // The sheet stays mounted and only toggles `isVisible`, as `BottomSheet` expects. With
  // no error it is hidden, so the fallbacks are never on screen.
  return {
    isVisible: sheet.isVisible,
    dismiss: sheet.dismiss,
    message: sheet.shown?.message ?? "",
    button: exits.actionButton(sheet.shown?.action ?? "tryAgain"),
    changeAmount: exits.changeAmount,
  }
}
