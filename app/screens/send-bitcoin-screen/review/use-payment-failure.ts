import { useCallback, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"

import { ErrorMsgAction, useErrorMsgAction } from "../error-msg-action"
import { PaymentDetail, PaymentSendExtraInfo } from "../payment-details/index.types"

type PaymentFailure = {
  message: string
  action: ErrorMsgAction
}

/** The send failure on show on review, and what the send that did not go out said about
 *  itself. */
export const usePaymentFailure = (paymentDetail: PaymentDetail<WalletCurrency>) => {
  const [paymentFailure, setPaymentFailure] = useState<PaymentFailure | undefined>(
    undefined,
  )
  const errorMsgActionFor = useErrorMsgAction(paymentDetail)
  /** Every send failure shows inline and opens the error message sheet on top. An
   *  explicit `action` is for failures whose outcome the raw text doesn't carry. */
  const setPaymentError = useCallback(
    (message: string, raw?: string, action?: ErrorMsgAction) =>
      setPaymentFailure({
        message,
        action: action ?? errorMsgActionFor(raw),
      }),
    [errorMsgActionFor],
  )
  /** What the last send that did not go out said about itself, for the actions it
   *  offers under its error. */
  const [failedSend, setFailedSend] = useState<PaymentSendExtraInfo | undefined>(
    undefined,
  )
  const clearPaymentError = useCallback(() => {
    setPaymentFailure(undefined)
    setFailedSend(undefined)
  }, [])
  /** The sender checked their history and chose to send anyway: the destination was
   *  released, so the send goes out now, as the button says. */
  const sendAnyway = useCallback(
    (send: () => void) => {
      clearPaymentError()
      send()
    },
    [clearPaymentError],
  )

  return {
    paymentFailure,
    setPaymentError,
    errorMsgActionFor,
    failedSend,
    setFailedSend,
    sendAnyway,
  }
}
