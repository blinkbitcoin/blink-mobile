import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const AMOUNT_ERROR_CODES: ReadonlySet<string> = new Set([
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
])

/** True when the failure is a classified code about the amount itself (too little
 *  balance, too small to send), so picking a different amount can resolve it. Server
 *  text never qualifies: its wording is not a contract, and it must not choose an action
 *  that builds a new payment. */
export const isAmountFixableError = (raw: string | undefined): boolean =>
  raw !== undefined && AMOUNT_ERROR_CODES.has(raw)
