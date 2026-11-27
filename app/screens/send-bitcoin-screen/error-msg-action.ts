import { useCallback } from "react"

import { WalletCurrency } from "@app/graphql/generated"

import { isAmountFixableError } from "./amount-fixable-error"
import { PaymentDetail } from "./payment-details/index.types"
import { IDEMPOTENCY_KEY_UNAVAILABLE } from "./use-send-payment"

/** Failures certain to be raised before anything is sent, so a new payment can be
 *  offered: the idempotency key could not be minted, so the send never started. The
 *  self-custodial amount and input codes are not here: on a send they are the SDK's word
 *  that nothing went out, read partly from its error text, and not certain enough. */
const NOTHING_SENT_CODES: ReadonlySet<string> = new Set([IDEMPOTENCY_KEY_UNAVAILABLE])

/** True only for a failure certain to be raised before the send. Server text, a
 *  classified code or no reason at all may have moved money. */
export const isNothingSentFailure = (raw: string | undefined): boolean =>
  raw !== undefined && NOTHING_SENT_CODES.has(raw)

/**
 * What the error message sheet on review offers (blink-wip#1278, provisional ruling
 * 2026-09-17, still open):
 * - `changeAmount`: back to amount entry with the amount emptied
 * - `tryAgain`: back to the first step with nothing entered
 * - `home`: out of the flow, for a payment that is finished or may still land
 */
export type ErrorMsgAction = "changeAmount" | "tryAgain" | "home"

/**
 * What is known about the payment when it failed:
 * - `notSent`: it failed before a send, like the fee quote
 * - `failed`: the send answered with a failure
 * - `unconfirmed`: the send threw, so the request may have landed
 */
export type FailureOutcome = "notSent" | "failed" | "unconfirmed"

type FailureContext = {
  /** The raw failure: a self-custodial error code, or custodial message text. */
  raw: string | undefined
  canSetAmount: boolean
  outcome: FailureOutcome
}

/**
 * The action for a failure the user can't fix on review.
 *
 * Change amount and Try again both build a new payment, so they are offered only when
 * nothing can have been sent: a failure before the send, or a key that could not be
 * minted. Every other failure, a custodial FAILURE included, goes Home: the payment
 * may still land, and a second one must never be possible (#1273 N18). Server text never
 * picks the action.
 */
export const errorMsgAction = ({
  raw,
  canSetAmount,
  outcome,
}: FailureContext): ErrorMsgAction => {
  const isNothingSent = outcome === "notSent" || isNothingSentFailure(raw)
  if (!isNothingSent) return "home"
  if (canSetAmount && isAmountFixableError(raw)) return "changeAmount"
  return "tryAgain"
}

/** `errorMsgAction` bound to the payment on review. */
export const useErrorMsgAction = (paymentDetail: PaymentDetail<WalletCurrency>) => {
  const { canSetAmount } = paymentDetail

  return useCallback(
    (raw: string | undefined, outcome: FailureOutcome = "failed") =>
      errorMsgAction({ raw, canSetAmount, outcome }),
    [canSetAmount],
  )
}
