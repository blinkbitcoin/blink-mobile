import { useCallback } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

import { isAmountFixableError } from "./amount-fixable-error"
import { PaymentDetail } from "./payment-details/index.types"
import { IDEMPOTENCY_KEY_UNAVAILABLE } from "./use-send-payment"

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
  isSelfCustodial: boolean
  outcome: FailureOutcome
}

/** Failures raised before anything is sent, whatever the send reported. */
const NOTHING_SENT: ReadonlySet<string> = new Set([
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
  SelfCustodialErrorCode.InvalidInput,
  IDEMPOTENCY_KEY_UNAVAILABLE,
])

/**
 * The action for a failure the user can't fix on review.
 *
 * If a new amount can be expected to fix it, the sheet offers Change amount. Otherwise it
 * offers Try again when nothing can have been paid, and Home when the payment may still
 * land. Try again starts a new payment with a new idempotency key, so no rail dedupes
 * it against the first (#1273 N21, senior devs).
 *
 * A custodial `FAILURE` means nothing was paid. A self-custodial failure isn't trusted
 * that far unless its code says the SDK stopped before sending, and a send that threw
 * may have landed on either rail.
 */
export const errorMsgAction = ({
  raw,
  canSetAmount,
  isSelfCustodial,
  outcome,
}: FailureContext): ErrorMsgAction => {
  if (canSetAmount && isAmountFixableError(raw)) return "changeAmount"
  if (outcome === "notSent" || (raw && NOTHING_SENT.has(raw))) return "tryAgain"
  if (outcome === "failed" && !isSelfCustodial) return "tryAgain"
  return "home"
}

/** `errorMsgAction` bound to the payment on review. */
export const useErrorMsgAction = (paymentDetail: PaymentDetail<WalletCurrency>) => {
  const { isSelfCustodial } = useActiveWallet()
  const { canSetAmount } = paymentDetail

  return useCallback(
    (raw: string | undefined, outcome: FailureOutcome = "failed") =>
      errorMsgAction({ raw, canSetAmount, isSelfCustodial, outcome }),
    [canSetAmount, isSelfCustodial],
  )
}
