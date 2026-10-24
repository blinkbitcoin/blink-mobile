import { useCallback } from "react"

import crashlytics from "@react-native-firebase/crashlytics"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useTranslateSdkError } from "@app/self-custodial/hooks/use-translate-sdk-error"
import { isSelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

import { isNothingSentFailure } from "../use-send-payment"

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
      crashlytics().log(`[send] failed: ${raw}`)
      if (isNothingSentFailure(raw)) {
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
