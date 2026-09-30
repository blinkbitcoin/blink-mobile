import Crypto from "react-native-quick-crypto"

import type { TelemetryEventId } from "./contract"

/**
 * Mints the random per-payment identifier deduplication depends on.
 *
 * It is derived from nothing. That is the property that lets a single string field exist in
 * the payload at all: a hashed pubkey is still a pubkey, so the id has to
 * come from a random source rather than from anything about the payment.
 *
 * **Stability across callbacks is the outbox's job, not this function's.** Addendum A2.3
 * names "a fresh id per callback" as the single most likely implementation error here, and
 * the fix is structural: the outbox keys its records on the local SDK payment id, so the
 * second callback for a settlement finds the record already written and the id minted here
 * is discarded before it can be transmitted. Keeping an in-memory map instead would have
 * lost the association at every process restart.
 */
export const mintTelemetryEventId = (): TelemetryEventId => Crypto.randomUUID()
