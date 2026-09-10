import type { TelemetryEvent, TelemetryPayload } from "../contract"

/**
 * One queued event, as it sits on disk.
 *
 * The state machine is the acknowledged one (FR-64, AD-17):
 *
 *   queued → submitted → acknowledged → cleaned
 *          ↘ expired (72h TTL)   ↘ evicted (capacity)   ↘ discarded (mode switch)
 *
 * `acknowledged` and `cleaned` have no on-disk representation: a record the receiver has
 * confirmed is removed, so the terminal states are the absence of a file. Only `queued` and
 * `submitted` persist, and a `submitted` record found at startup returns to `queued` — the
 * process died between hand-off and confirmation, and the `telemetryEventId` is unchanged,
 * so a resubmission costs a deduplicated row rather than a second count.
 *
 * Building the strong machine and letting an adapter degrade it is the point of FR-64:
 * building the weak one first and strengthening it later means rewriting retry, cleanup and
 * reconciliation semantics under a system already in production.
 */

export const OutboxState = {
  Queued: "queued",
  Submitted: "submitted",
} as const

export type OutboxState = (typeof OutboxState)[keyof typeof OutboxState]

export type OutboxRecord = {
  /** The dedup key the reporting layer groups on (FR-26). */
  telemetryEventId: string
  event: TelemetryEvent
  /** Exactly what the policy stage approved — the adapter is handed this, and nothing else. */
  payload: TelemetryPayload
  /**
   * Local only, never transmitted (FR-24). It is the key that makes a re-delivered
   * settlement callback reuse its original record instead of minting a second one, which
   * addendum A2.3 names as the single most likely implementation error in this feature.
   */
  sdkPaymentId: string | null
  /** Local only. Feeds the 72h TTL and nothing else; it never reaches a payload. */
  queuedAt: number
  state: OutboxState
}

/**
 * The record's identity on disk. Keying on the SDK payment id is what makes `enqueue`
 * idempotent per settlement: the second callback for a payment finds the file already
 * there and writes nothing, so the id it would have carried never exists. An event with no
 * payment to key on falls back to its own id and is therefore unkeyed — inventing a key
 * out of payment data to make it look deduplicable is exactly the derivation §5.5 forbids.
 */
export const dedupKeyFor = (record: {
  sdkPaymentId: string | null
  telemetryEventId: string
}): string =>
  record.sdkPaymentId
    ? `p-${record.sdkPaymentId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120)}`
    : `e-${record.telemetryEventId}`

const isPayload = (value: unknown): value is TelemetryPayload =>
  Boolean(value) &&
  typeof value === "object" &&
  Object.values(value as object).every(
    (entry) => typeof entry === "string" || typeof entry === "number",
  )

/** A record written by an older build, a truncated write or a half-finished delete all look
 *  the same from here: unreadable, and dropped rather than guessed at. */
export const parseOutboxRecord = (raw: string): OutboxRecord | null => {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const candidate = parsed as Partial<OutboxRecord>
    if (typeof candidate.telemetryEventId !== "string") return null
    if (typeof candidate.event !== "string") return null
    if (typeof candidate.queuedAt !== "number") return null
    if (!isPayload(candidate.payload)) return null

    return {
      telemetryEventId: candidate.telemetryEventId,
      event: candidate.event,
      payload: candidate.payload,
      sdkPaymentId:
        typeof candidate.sdkPaymentId === "string" ? candidate.sdkPaymentId : null,
      queuedAt: candidate.queuedAt,
      /** Anything that was mid-flight when the process died is retried. */
      state: OutboxState.Queued,
    }
  } catch {
    return null
  }
}
