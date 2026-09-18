/**
 * The outbox's numbers (AD-18, AD-26). Derived, not chosen, and the derivation is here so
 * the next person can re-run it rather than re-guess it.
 */

export const OUTBOX_TTL_MS = 72 * 60 * 60 * 1000

/**
 * FR-29's 2% total loss budget is split once and sums: device-side (eviction plus expiry)
 * ≤1%, transport and warehouse together ≤1% (AD-17). Capacity is sized backwards from the
 * device-side share: `ceil(p99 settlements per device per 72h × 100)`, the ×100 being the
 * inverse of 1% — a device at the 99th percentile of activity fills 1% of its outbox over a
 * full TTL window while offline, so eviction under that load is by definition inside the
 * budget, and any eviction above it is a defect signal rather than noise.
 *
 * **[ASSUMPTION — the p99 input is not yet measured.]** The formula is fixed; the number
 * is not. 5 settlements per device per 72h is a placeholder standing in for Q14, which is
 * data's to answer. Change the input, never the formula.
 */
const P99_SETTLEMENTS_PER_DEVICE_PER_TTL_ASSUMED = 5
const INVERSE_DEVICE_SHARE = 100

export const OUTBOX_MAX_RECORDS = Math.ceil(
  P99_SETTLEMENTS_PER_DEVICE_PER_TTL_ASSUMED * INVERSE_DEVICE_SHARE,
)

/**
 * Schema tolerance (AD-30): after an upgrade the outbox may hold records written by the
 * previous contract version. They are still delivered for as long as the relay accepts
 * n−1 — 30 days — and anything older than n−1 counts as `Expired` rather than being sent
 * to a relay that will reject it.
 */
export const OUTBOX_SCHEMA_VERSIONS_TOLERATED = 1

/** Exponential backoff for `retryable`, per account: 5 s doubling to a 15 min cap. */
export const DRAIN_BACKOFF_INITIAL_MS = 5_000
export const DRAIN_BACKOFF_MAX_MS = 15 * 60 * 1000
