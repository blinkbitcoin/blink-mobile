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

type FailureContext = {
  /** The raw failure: a self-custodial error code, or custodial message text. */
  raw: string | undefined
  canSetAmount: boolean
  isSelfCustodial: boolean
  /** A self-custodial rail where starting again can't pay twice. */
  isRetrySafe: boolean
  /** False for a failure before the send, like the fee quote: nothing can land. */
  hasSent: boolean
}

/** Self-custodial failures the SDK raises before anything is sent. */
const SELF_CUSTODIAL_NOTHING_SENT: ReadonlySet<string> = new Set([
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
  SelfCustodialErrorCode.InvalidInput,
  IDEMPOTENCY_KEY_UNAVAILABLE,
])

/**
 * The action for a failure the user can't fix on review.
 *
 * If a new amount can be expected to fix it, the sheet offers Change amount. Otherwise it
 * offers Try again, unless the failure came after a self-custodial send that may still
 * land on a rail where starting again could pay twice (#1273 N18); those go Home.
 * Custodial failures come back as `FAILURE`, which means nothing was paid.
 */
export const errorMsgAction = ({
  raw,
  canSetAmount,
  isSelfCustodial,
  isRetrySafe,
  hasSent,
}: FailureContext): ErrorMsgAction => {
  if (canSetAmount && isAmountFixableError(raw)) return "changeAmount"
  if (!hasSent || !isSelfCustodial || isRetrySafe) return "tryAgain"
  if (raw && SELF_CUSTODIAL_NOTHING_SENT.has(raw)) return "tryAgain"
  return "home"
}

/** `errorMsgAction` bound to the payment on review. */
export const useErrorMsgAction = (paymentDetail: PaymentDetail<WalletCurrency>) => {
  const { isSelfCustodial } = useActiveWallet()
  // #1273 N18: only the Bitcoin wallet to a Lightning address carries one key end to end.
  const isRetrySafe =
    paymentDetail.paymentType === "lnurl" &&
    paymentDetail.sendingWalletDescriptor.currency === WalletCurrency.Btc
  const { canSetAmount } = paymentDetail

  return useCallback(
    (raw: string | undefined, { hasSent = true }: { hasSent?: boolean } = {}) =>
      errorMsgAction({ raw, canSetAmount, isSelfCustodial, isRetrySafe, hasSent }),
    [canSetAmount, isSelfCustodial, isRetrySafe],
  )
}
