import { useCallback, useMemo } from "react"

import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"

import type { PaymentSendCompletedStatus } from "@app/screens/send-bitcoin-screen/use-send-payment"

/**
 * How the investment follows its payment through the generic send flow, which pays its
 * invoice like any other and knows nothing of it.
 *
 * The invoice on record is what tells the investment's payment from the rest. Any
 * receipt for it marks the investment paid, a pending one included: holding the record
 * while the payment is in flight would have the home ask for the money again. The mark
 * is taken once: a later receipt for the same invoice, the retry that met "already
 * paid", finds the mark and leaves it.
 */
export const useCardInvestmentPaymentObserver = (): {
  isObserved: (paymentRequest: string | undefined) => boolean
  onSettled: (paymentRequest: string, status: PaymentSendCompletedStatus) => void
} => {
  const { isInvestmentInvoice, markPaid } = useCardInvestmentProgress()

  const onSettled = useCallback(() => {
    markPaid()
  }, [markPaid])

  return useMemo(
    () => ({ isObserved: isInvestmentInvoice, onSettled }),
    [isInvestmentInvoice, onSettled],
  )
}
