import Crypto from "react-native-quick-crypto"

import type { TelemetryEventId } from "./contract"

/**
 * Mints and remembers the random per-payment identifier that deduplication depends on.
 *
 * The rule this file exists to enforce: the id is created **once**, when the domain event
 * for a payment first fires, and every later callback for that same payment reuses it
 * unchanged (FR-22). Minting a fresh id per callback produces code that looks correct,
 * reviews clean, and silently double-counts every retried payment — the addendum names it
 * the single most likely implementation error in this feature (A2.3).
 *
 * The id is random and derived from nothing (FR-23). The SDK payment id is held here as a
 * map key so the association survives across callbacks, and is never transmitted (FR-24).
 */

/**
 * The map is in memory only, so it does not survive a process restart. A settlement
 * callback re-delivered in a *later* session therefore mints a second id and counts twice.
 * Persisting it belongs with the outbox, which is blocked on OD-1; until that closes, the
 * residual duplication is bounded by how often the SDK re-delivers across a restart and is
 * stated in the `payment_settled` metric contract rather than papered over here.
 */
const MAX_TRACKED_PAYMENTS = 500

const idsByPaymentId = new Map<string, TelemetryEventId>()

/**
 * The id for a payment, minted on first sight and stable thereafter.
 *
 * Callers pass the SDK's payment id purely as the local key. When the SDK gives us nothing
 * to key on, a bare random id is returned and not retained: an unkeyed event cannot be
 * deduplicated, but inventing a key out of payment data to make it look deduplicable is
 * exactly the derivation the contract forbids.
 */
export const telemetryEventIdFor = (
  sdkPaymentId: string | null | undefined,
): TelemetryEventId => {
  if (!sdkPaymentId) return Crypto.randomUUID()

  const existing = idsByPaymentId.get(sdkPaymentId)
  if (existing) return existing

  const minted = Crypto.randomUUID()
  idsByPaymentId.set(sdkPaymentId, minted)

  /** Insertion-ordered, so the first key is the oldest. */
  if (idsByPaymentId.size > MAX_TRACKED_PAYMENTS) {
    const oldest = idsByPaymentId.keys().next()
    if (!oldest.done) idsByPaymentId.delete(oldest.value)
  }

  return minted
}

export const resetTelemetryEventIdsForTesting = (): void => {
  idsByPaymentId.clear()
}
