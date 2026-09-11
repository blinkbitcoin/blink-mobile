import type { TelemetryEvent, TelemetryPayload } from "./contract"

/**
 * The port (AD-4, AD-17, FR-64). The outbox reaches a transport only through this seam, so
 * choosing one later is an adapter plus a landing relay rather than a reimplementation of
 * the contract, the outbox, the dedup model and the board tiles.
 *
 * **No adapter ships with this code, and that is the current state of the decision, not an
 * omission.** OD-1 is unsigned. OD-7 was resolved on 2026-09-11 as CD-6 — GA4's
 * `user_pseudo_id` tolerated on the first adapter as a scoped exception — but that
 * exception's primary path needs the SDK to suppress its automatic events while contract
 * events still flow, and it cannot (Q13, verified in `platform-analytics.ts`). The
 * fallback the PRD fixed in advance is what this port serves: Enhanced telemetry over an
 * identity-free endpoint, custodial analytics staying on GA4 outside the port. Until that
 * adapter is registered the outbox fills, respects its bound, and lets records expire;
 * every one of those outcomes is counted (FR-68), so the cost of the open decision is a
 * number rather than a silence.
 *
 * FR-64's degrade path is reinstated by the spine and this shape already carries it: an
 * adapter without application-level acknowledgment returns `acknowledged` at hand-off,
 * which collapses `submitted → acknowledged` into one transition and leaves the outbox
 * unchanged. Designing for the weaker semantics and strengthening later is a rewrite;
 * this way it is one line in the adapter.
 *
 * Two things the port deliberately does *not* do:
 *
 *  - It takes one payload, never a batch. AD-4 keeps the outbox row — which holds the
 *    local-only `sdkPaymentId` — out of adapter reach, and a batch would hand the receiver
 *    an explicit per-device equivalence class, which is the linkage AD-22 is about.
 *  - It gives an adapter no way to attach identity of its own. `attachesPerEventIdentity`
 *    is a literal `false`, so an adapter that cannot make that declaration does not
 *    type-check as a candidate. CD-6 would have admitted one such adapter; Q13 removed it
 *    from this port's Enhanced path, so on this port the declaration is also what keeps
 *    FR-70 true — the one candidate that attaches identity is the one whose SDK emits the
 *    automatic events alongside it.
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
   * AD-17, as amended: identity-attaching transports are tolerated only under CD-6, whose
   * primary path Q13 closes on this SDK. For everything this port will ever carry, the
   * declaration is a requirement, and it is part of the type so it cannot be waived in a
   * code review.
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
