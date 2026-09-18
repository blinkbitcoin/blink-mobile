import type { ContractPayload } from "./contract"

/**
 * The port (AD-4, AD-17, AD-27, FR-64). The outbox reaches a transport only through this
 * seam, so choosing one later is an adapter plus a landing relay rather than a
 * reimplementation of the contract, the outbox, the dedup model and the board tiles.
 *
 * OD-7 is ruled — PRD CD-7: the first adapter for Enhanced telemetry is a Blink endpoint;
 * custodial analytics stay on GA4 and never pass through here. The ruling's history is in
 * AD-17: the 09-07 draft disqualified GA4 outright, the 09-11 re-review tolerated it as a
 * scoped exception (CD-6), and same-day validation found that exception's primary path
 * impossible — the SDK cannot suppress its reserved automatic events while `logEvent()` is
 * live (Q13, verified against `@react-native-firebase/analytics@23.3.1` in
 * `platform-analytics.ts`). The endpoint itself is deferred behind this port; until it is
 * registered, `LocalOnlyTransport` stands in so the client work is exercisable end to end.
 *
 * The port admits both acknowledgment semantics so the outbox state machine is built once
 * (FR-64): an `application`-ack adapter runs it whole, a `hand-off` adapter collapses
 * `submitted → acknowledged` into one transition. Whether a `hand-off` adapter may ever be
 * *selected* for self-custodial events is AD-17's rule, not the port's — and the answer is
 * no while that rule stands.
 *
 * Two things the port deliberately does *not* do:
 *
 *  - It takes one payload, never a batch. AD-4 keeps the outbox row — which holds the
 *    local-only `sdkPaymentId` — out of adapter reach, and a batch would hand the receiver
 *    an explicit per-device equivalence class, which is the linkage AD-22 is about.
 *  - It gives an adapter no way to attach identity of its own. `attachesNoImplicitIdentity`
 *    is a literal `true`, so an adapter that cannot make that declaration does not compile.
 */

export type SubmitResult =
  /** The receiver confirmed the id. The record may be cleaned. */
  | { kind: "acknowledged"; ackedAt: number }
  /** The event left the process and delivery is unknowable. Legal only from an adapter
   *  whose `ackSemantics` is `"hand-off"`; the drain treats it as acknowledged (FR-64). */
  | { kind: "handed_off" }
  /** Permanent. Retrying cannot help; counted under FR-68. */
  | { kind: "rejected"; reason: string }
  /** Transient. The record returns to `queued`; the drain backs off (AD-26). */
  | { kind: "retryable"; retryAfterMs?: number }

export interface TelemetryTransport {
  readonly name: string
  readonly ackSemantics: "application" | "hand-off"
  /** AD-17. An adapter that cannot declare this does not compile. */
  readonly attachesNoImplicitIdentity: true
  submit(payload: ContractPayload): Promise<SubmitResult>
}

/**
 * The null adapter (AD-27). Acknowledges everything and keeps the last few hundred payloads
 * in a ring buffer the developer screen can read, so QA can watch what would have left the
 * device while OD-1 is unsigned. Nothing leaves the process.
 */
export const LOCAL_ONLY_RING_SIZE = 200

export type LocalOnlyEntry = { readonly at: number; readonly payload: ContractPayload }

export const createLocalOnlyTransport = (): TelemetryTransport & {
  readonly entries: () => readonly LocalOnlyEntry[]
  readonly clear: () => void
} => {
  const ring: LocalOnlyEntry[] = []
  return {
    name: "local-only",
    ackSemantics: "application",
    attachesNoImplicitIdentity: true,
    submit: (payload) => {
      ring.push({ at: Date.now(), payload })
      if (ring.length > LOCAL_ONLY_RING_SIZE) ring.shift()
      return Promise.resolve({ kind: "acknowledged", ackedAt: Date.now() })
    },
    entries: () => [...ring],
    clear: () => {
      ring.length = 0
    },
  }
}

/** The one instance the app registers, so the developer screen and the drain see the same
 *  buffer. */
export const localOnlyTransport = createLocalOnlyTransport()

let transport: TelemetryTransport | null = null

/** Called once by whichever adapter OD-1 selects; `localOnlyTransport` until then. */
export const registerTelemetryTransport = (next: TelemetryTransport): void => {
  transport = next
}

export const getTelemetryTransport = (): TelemetryTransport | null => transport

export const resetTelemetryTransportForTesting = (): void => {
  transport = null
  localOnlyTransport.clear()
}
