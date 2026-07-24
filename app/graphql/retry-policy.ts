import type { Operation } from "@apollo/client"
import type { NetworkError } from "@apollo/client/errors"

/**
 * GraphQL operations the global RetryLink must never auto-resend. These are
 * non-idempotent: money-moving payments and the state-committing migration mutations. A
 * lost response is not proof the request never landed, so a blind resend can duplicate
 * the operation (a resent migrationCommit mints a second invoice the backend refuses as a
 * state conflict, which would route a succeeding migration to support). Recovery for
 * these is owned by the callers, which surface a user-driven retry rather than retrying
 * silently at the transport layer.
 */
const noRetryOperations = [
  "intraLedgerPaymentSend",
  "intraLedgerUsdPaymentSend",

  "lnInvoiceFeeProbe",
  "lnInvoicePaymentSend",
  "lnNoAmountInvoiceFeeProbe",
  "lnNoAmountInvoicePaymentSend",
  "lnNoAmountUsdInvoiceFeeProbe",
  "lnUsdInvoiceFeeProbe",
  "lnNoAmountUsdInvoicePaymentSend",

  "onChainPaymentSend",
  "onChainPaymentSendAll",
  "onChainUsdPaymentSend",
  "onChainUsdPaymentSendAsBtcDenominated",
  "onChainTxFee",
  "onChainUsdTxFee",
  "onChainUsdTxFeeAsBtcDenominated",

  // no need to retry to upload the token
  // specially as it's running on app start
  // and can create some unwanted loop when token is not valid
  "deviceNotificationTokenCreate",

  // Self-custodial payments go through Breez SDK directly, not Apollo; these
  // custodial-to-self-custodial migration mutations do go through Apollo and are
  // non-idempotent, so a lost response must not trigger a blind resend.
  "migrationStart",
  "migrationCommit",
  "migrationLnAddressTransfer",
]

const UNAUTHORIZED_STATUS = 401

const IDEMPOTENCY_KEY_HEADER = "x-idempotency-key"

/**
 * Whether the operation's context carries an X-Idempotency-Key header. Such an operation
 * must never be transport-retried: the server may have already processed the first
 * attempt, and a replay with the same key is rejected with 409 Conflict, masking a
 * successful payment as a failure. The header lookup is case-insensitive so a future
 * casing change cannot silently disable this gate.
 */
export const hasIdempotencyKey = (operation: Operation): boolean => {
  const headers = operation.getContext().headers as Record<string, unknown> | undefined
  if (!headers) {
    return false
  }
  return Object.keys(headers).some(
    (key) => key.toLowerCase() === IDEMPOTENCY_KEY_HEADER && Boolean(headers[key]),
  )
}

/**
 * Whether the RetryLink should resend a failed operation. It resends only when there is a
 * genuine error, the operation is not on the no-retry list, and the failure is not a 401
 * (auth is handled by a dedicated retry link with its own backoff).
 */
export const shouldRetryOperation = (
  error: NetworkError,
  operationName: string,
): boolean => {
  const hasError = Boolean(error)
  const isRetryableOperation = !noRetryOperations.includes(operationName)
  const isUnauthorized =
    (error as { statusCode?: number } | null)?.statusCode === UNAUTHORIZED_STATUS
  return hasError && isRetryableOperation && !isUnauthorized
}
