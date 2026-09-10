import type { TelemetryEvent, TelemetryPayload } from "./contract"

/**
 * The port (AD-4, AD-17, FR-64). The outbox reaches a transport only through this seam, so
 * choosing one later is an adapter plus a landing relay rather than a reimplementation of
 * the contract, the outbox, the dedup model and the board tiles.
 *
 * **No adapter ships with this code, and that is the current state of the decision, not an
 * omission.** OD-1 is unsigned and OD-7 blocks it: GA4 attaches `user_pseudo_id` to every
 * event by construction and it cannot be disabled, which §5.6 forbids outright — so the
 * transport the D1 review recommended is disqualified on grounds that review never weighed.
 * Until an adapter is registered the outbox fills, respects its bound, and lets records
 * expire; every one of those outcomes is counted (FR-68), so the cost of the open decision
 * is a number rather than a silence.
 *
 * Two things the port deliberately does *not* do:
 *
 *  - It takes one payload, never a batch. AD-4 keeps the outbox row — which holds the
 *    local-only `sdkPaymentId` — out of adapter reach, and a batch would hand the receiver
 *    an explicit per-device equivalence class, which is the linkage AD-22 is about.
 *  - It gives an adapter no way to attach identity of its own. `attachesPerEventIdentity`
 *    is a literal `false`, so an adapter that cannot make that declaration does not
 *    type-check as a candidate.
 */

export type TransportResult =
  /** The receiver durably accepted this id. The record may be cleaned. */
  | { outcome: "acknowledged" }
  /** The receiver refused it permanently. Retrying cannot help; count it as loss (FR-68). */
  | { outcome: "rejected"; reason?: string }
  /** Transient. The record returns to `queued` and is retried within its TTL. */
  | { outcome: "unavailable" }

export type TelemetryTransport = {
  readonly name: string
  /**
   * AD-17. An adapter attaching a device-stable identifier of its own breaches §5.6 no
   * matter how correct the payload is, so the declaration is part of the type.
   */
  readonly attachesPerEventIdentity: false
  submit: (event: TelemetryEvent, payload: TelemetryPayload) => Promise<TransportResult>
}

let transport: TelemetryTransport | null = null

/** Called once by whichever adapter OD-1 selects. */
export const registerTelemetryTransport = (next: TelemetryTransport): void => {
  transport = next
}

export const getTelemetryTransport = (): TelemetryTransport | null => transport

export const resetTelemetryTransportForTesting = (): void => {
  transport = null
}
