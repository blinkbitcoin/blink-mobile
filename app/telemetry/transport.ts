import type { ContractPayload } from "./contract"

/**
 * The port. The outbox reaches a transport only through this
 * seam, so choosing one later is an adapter plus a landing relay rather than a
 * reimplementation of the contract, the outbox, the dedup model and the board tiles.
 *
 * The decision is made: self-custodial events go to a Blink endpoint, and custodial
 * analytics stay on GA4 and never pass through here. GA4 was considered for both and ruled
 * out, because the SDK cannot suppress its own automatic events while `logEvent()` stays
 * live — verified against `@react-native-firebase/analytics@23.3.1`, see
 * `platform-analytics.ts`. The endpoint itself is still to come; until an adapter
 * registers,
 * `localOnlyTransport` stands in so the client work can be exercised end to end.
 *
 * The port admits both acknowledgment styles so the outbox state machine is built once: an
 * `application`-ack adapter runs it whole, a `hand-off` adapter collapses
 * `submitted → acknowledged` into one transition. Whether a `hand-off` adapter may be
 * chosen for self-custodial events at all is a separate decision, and the answer is
 * currently no.
 *
 * Two things the port deliberately does *not* do:
 *
 *  - It takes one payload, never a batch. The outbox row — which holds the local-only
 *    `sdkPaymentId` — stays out of an adapter's reach, and a batch would hand the receiver
 *    a set of events it knows came from one device, which is the linkage the shuffle in the
 *    drain exists to avoid.
 *  - It gives an adapter no way to attach identity of its own. `attachesNoImplicitIdentity`
 *    is a literal `true`, so an adapter that cannot make that declaration does not compile.
 */

export type SubmitResult =
  /** The receiver confirmed the id. The record may be cleaned. */
  | { kind: "acknowledged"; ackedAt: number }
  /** The event left the process and delivery is unknowable. Legal only from an adapter
   *  whose `ackSemantics` is `"hand-off"`; the drain treats it as acknowledged. */
  | { kind: "handed_off" }
  /** Permanent. Retrying cannot help; counted as loss. */
  | { kind: "rejected"; reason: string }
  /** Transient. The record returns to `queued`; the drain backs off. */
  | { kind: "retryable"; retryAfterMs?: number }

export interface TelemetryTransport {
  readonly name: string
  readonly ackSemantics: "application" | "hand-off"
  /** An adapter that cannot declare this does not compile. */
  readonly attachesNoImplicitIdentity: true
  submit(payload: ContractPayload): Promise<SubmitResult>
}

/**
 * The null adapter. Acknowledges everything and keeps the last few hundred payloads
 * in a ring buffer the developer screen can read, so QA can watch what would have left the
 * device until a real adapter exists. Nothing leaves the process.
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

/** Called once by whichever adapter ships first; `localOnlyTransport` until then. */
export const registerTelemetryTransport = (next: TelemetryTransport): void => {
  transport = next
}

export const getTelemetryTransport = (): TelemetryTransport | null => transport

export const resetTelemetryTransportForTesting = (): void => {
  transport = null
  localOnlyTransport.clear()
}
