/**
 * The send flow pays for every part of the app, and some of those parts need to know
 * when their payment went through: not by being in the send flow's screens, which are
 * the one place every payment passes, but by watching from outside them.
 *
 * An observer says which payments are its, and is told when one of them reaches a
 * receipt. The send flow asks the observers together, through this one hook, and never
 * asks any of them on its own.
 */

import { useMemo } from "react"

import { useCardInvestmentPaymentObserver } from "@app/screens/card-screen/onboarding/investment-flow/use-card-investment-payment-observer"

import type { PaymentSendCompletedStatus } from "../use-send-payment"

export type PaymentObserver = {
  /** Whether a payment, named by the invoice it pays, is one this observer follows. */
  isObserved: (paymentRequest: string | undefined) => boolean
  /** Told once one of its payments reaches a receipt, with the status it reached it in. */
  onSettled: (paymentRequest: string, status: PaymentSendCompletedStatus) => void
}

/**
 * Every observer as one: a payment is observed when any of them follows it, and each
 * one that does is told when it settles. Each part of the app that watches its payments
 * through the send flow is called here by name, since hooks cannot be gathered in a
 * list and called from it; adding an observer is adding a line.
 */
export const usePaymentObservers = (): PaymentObserver => {
  const cardInvestment = useCardInvestmentPaymentObserver()

  /** One object for as long as no observer changes, so an effect keyed on it does not
   *  run on every render. */
  return useMemo(() => {
    const observers: readonly PaymentObserver[] = [cardInvestment]
    return {
      isObserved: (paymentRequest) =>
        observers.some((observer) => observer.isObserved(paymentRequest)),
      onSettled: (paymentRequest, status) => {
        observers
          .filter((observer) => observer.isObserved(paymentRequest))
          .forEach((observer) => observer.onSettled(paymentRequest, status))
      },
    }
  }, [cardInvestment])
}
