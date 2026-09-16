import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const AMOUNT_ERROR_CODES: ReadonlySet<string> = new Set([
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
])

/** Custodial failures arrive as the backend's message text with no code, so they are
 *  matched on the wording blinkbitcoin/blink builds them from: balance (payment-flow.ts,
 *  send-on-chain.ts), 24h limits (limits-checker.ts), dust (onchain-payment-flow-builder.ts)
 *  and the recipient USD wallet floor (error-map.ts). */
const AMOUNT_ERROR_PATTERNS: ReadonlyArray<RegExp> = [
  /exceeds balance/i,
  /no balance left to send/i,
  /cannot transfer more than .+ in 24 hours/i,
  /use lightning to send amounts less than/i,
  /amount sent was too low/i,
]

/** True when the failure is about the amount itself (too little balance, too small to
 *  send, over a limit), so picking a different amount can resolve it. */
export const isAmountFixableError = (raw: string | undefined): boolean => {
  if (!raw) return false
  if (AMOUNT_ERROR_CODES.has(raw)) return true
  return AMOUNT_ERROR_PATTERNS.some((pattern) => pattern.test(raw))
}
