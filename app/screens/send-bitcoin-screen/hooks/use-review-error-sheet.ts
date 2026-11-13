import { useMemo, useRef } from "react"

import { useDisplayCurrency } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import type { SendDustWarning } from "@app/self-custodial/hooks/use-send-dust-warning"
import { isSelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

import type { ErrorMsgAction, FailureOutcome } from "../error-msg-action"
import { useDismissibleErrorMsg } from "./use-dismissible-error-msg"
import { useReviewExits } from "./use-review-exits"

type ReviewError = { message: string; action: ErrorMsgAction }

/** What the sheet has on show: an error with its way out, or a notice the user only
 *  needs to acknowledge. */
type SheetContent = { message: string; action: ErrorMsgAction } | { notice: true }

type Args = {
  /** The send failure on show, if any. */
  paymentFailure: ReviewError | undefined
  /** The total is over the balance (R4). */
  amountError: string | undefined
  canSetAmount: boolean
  isFeeFailed: boolean
  feeErrorCode: string | undefined
  feeErrorText: string
  /** The USD dust sweep (R5): information to acknowledge before sending. */
  dustWarning: SendDustWarning
  errorMsgActionFor: (raw: string | undefined, outcome?: FailureOutcome) => ErrorMsgAction
}

/**
 * The error message sheet on review (blink-wip#1278), opened on top of the inline error
 * or notice, first match wins:
 * - a send failure
 * - a total over the balance (R4): Change amount, or Try again when the invoice fixes the
 *   amount. Nothing has been sent, so its action can never pay twice.
 * - a self-custodial fee quote that failed with a classified code (R2). Custodial fee
 *   failures carry raw text and stay inline.
 * - the USD dust sweep notice (R5), with OK only closing the sheet
 *
 * It also formats the dust sweep text for the banner under Details.
 */
export const useReviewErrorSheet = ({
  paymentFailure,
  amountError,
  canSetAmount,
  isFeeFailed,
  feeErrorCode,
  feeErrorText,
  dustWarning,
  errorMsgActionFor,
}: Args) => {
  const { LL } = useI18nContext()
  const { formatMoneyAmount } = useDisplayCurrency()
  const exits = useReviewExits()

  const dustSweepText =
    dustWarning.status === "visible"
      ? LL.SendBitcoinConfirmationScreen.usdRemainderSweep({
          remaining: formatMoneyAmount({ moneyAmount: dustWarning.remaining }),
          remainingSats: formatMoneyAmount({ moneyAmount: dustWarning.remainingSats }),
          minimum: formatMoneyAmount({ moneyAmount: dustWarning.minimum }),
        })
      : undefined

  const overBalance = useMemo<SheetContent | undefined>(
    () =>
      amountError
        ? { message: amountError, action: canSetAmount ? "changeAmount" : "tryAgain" }
        : undefined,
    [amountError, canSetAmount],
  )

  const feeError = useMemo<SheetContent | undefined>(
    () =>
      isFeeFailed && isSelfCustodialErrorCode(feeErrorCode)
        ? {
            message: feeErrorText,
            action: errorMsgActionFor(feeErrorCode, "notSent"),
          }
        : undefined,
    [isFeeFailed, feeErrorCode, feeErrorText, errorMsgActionFor],
  )

  // Keyed on whether the notice shows, not on its text: the amounts in it follow the
  // price, and a dismissed notice must not reopen on every price update.
  const hasNotice = Boolean(dustSweepText)
  const noticeSlot = useMemo<SheetContent | undefined>(
    () => (hasNotice ? { notice: true } : undefined),
    [hasNotice],
  )
  const lastNoticeText = useRef(dustSweepText)
  if (dustSweepText) lastNoticeText.current = dustSweepText

  const sheet = useDismissibleErrorMsg<SheetContent>(
    paymentFailure ?? overBalance ?? feeError ?? noticeSlot,
  )

  // The sheet stays mounted and only toggles `isVisible`, as `BottomSheet` expects. With
  // nothing to show it is hidden, so the fallbacks are never on screen.
  const shown = sheet.shown
  if (shown && "notice" in shown) {
    return {
      isVisible: sheet.isVisible,
      dismiss: sheet.dismiss,
      title: LL.SendBitcoinConfirmationScreen.dustSweepSheetTitle(),
      message: lastNoticeText.current ?? "",
      button: { primaryLabel: LL.common.ok(), onPrimaryPress: sheet.dismiss },
      changeAmount: exits.changeAmount,
      dustSweepText,
    }
  }

  return {
    isVisible: sheet.isVisible,
    dismiss: sheet.dismiss,
    title: LL.SendBitcoinScreen.problemSheetTitle(),
    message: shown?.message ?? "",
    button: exits.actionButton(shown?.action ?? "tryAgain"),
    changeAmount: exits.changeAmount,
    dustSweepText,
  }
}
