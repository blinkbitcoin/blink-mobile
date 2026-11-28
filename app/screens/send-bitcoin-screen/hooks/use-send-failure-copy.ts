import { useCallback } from "react"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useTranslateSdkError } from "@app/self-custodial/hooks/use-translate-sdk-error"
import {
  isSelfCustodialErrorCode,
  SelfCustodialErrorCode,
} from "@app/self-custodial/sdk-error"
import { logBreadcrumb } from "@app/utils/error-reporting"

import { IDEMPOTENCY_KEY_UNAVAILABLE } from "../use-send-payment"

/** Failures that name their own cause: classified as raised before the send. Only the
 *  copy reads them; the action stays Home for every one after a send attempt, since the
 *  SDK's classification is not proof that nothing went out (error-msg-action.ts). */
const CAUSE_CODES: ReadonlySet<string> = new Set([
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
  SelfCustodialErrorCode.InvalidInput,
  IDEMPOTENCY_KEY_UNAVAILABLE,
])

/** Codes whose own copy already says what became of the payment, and goes with the
 *  actions offered under it. */
const OUTCOME_CODES: ReadonlySet<string> = new Set([
  SelfCustodialErrorCode.OutcomeUnknown,
  SelfCustodialErrorCode.EarlierPaymentFound,
])

/**
 * The fixed copy for a send that failed. Server text is never shown: it goes to the logs.
 * A classified failure raised before the send names its cause. Any other one may have
 * sent, unless the backend answered FAILURE, so it says the money will arrive or stay.
 */
export const useSendFailureCopy = () => {
  const { LL } = useI18nContext()
  const translateSdkError = useTranslateSdkError()

  return useCallback(
    (raw: string | undefined, { mayHaveSent = false } = {}) => {
      logBreadcrumb(`[send] failed: ${raw}`)
      if (raw && OUTCOME_CODES.has(raw)) {
        return (
          translateSdkError(raw) || LL.SendBitcoinConfirmationScreen.somethingWentWrong()
        )
      }
      if (raw && CAUSE_CODES.has(raw)) {
        return (
          (isSelfCustodialErrorCode(raw) && translateSdkError(raw)) ||
          LL.SendBitcoinConfirmationScreen.somethingWentWrong()
        )
      }
      return mayHaveSent || isSelfCustodialErrorCode(raw)
        ? LL.SendBitcoinConfirmationScreen.paymentMayStillLand()
        : LL.SendBitcoinConfirmationScreen.somethingWentWrong()
    },
    [LL, translateSdkError],
  )
}
