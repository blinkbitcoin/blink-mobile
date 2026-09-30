import { useCallback, useMemo } from "react"

import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"

import type { PaymentSendCompletedStatus } from "@app/screens/send-bitcoin-screen/use-send-payment"

/**
 * How the investment follows its payment through the generic send flow, which pays its
 * invoice like any other and knows nothing of it.
 *
 * The invoice on record is what tells the investment's payment from the rest. A receipt
 * that settled marks the investment paid; one still pending marks it as paying, since
 * a pending payment can still fail and the record has a way back from "paying" but not
 * from "paid". Each mark is taken once: a later receipt for the same invoice, the retry
 * that met "already paid", finds the mark and leaves it.
 */
export const useCardInvestmentPaymentObserver = (): {
  isObserved: (paymentRequest: string | undefined) => boolean
  onSettled: (paymentRequest: string, status: PaymentSendCompletedStatus) => void
} => {
  const { isInvestmentInvoice, markPaid, markPaying } = useCardInvestmentProgress()

  const onSettled = useCallback(
    (_paymentRequest: string, status: PaymentSendCompletedStatus) => {
      if (status === "SUCCESS") {
        markPaid()
        return
      }
      markPaying()
    },
    [markPaid, markPaying],
  )

  return useMemo(
    () => ({ isObserved: isInvestmentInvoice, onSettled }),
    [isInvestmentInvoice, onSettled],
  )
}
