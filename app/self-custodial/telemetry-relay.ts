import {
  type ContractPayload,
  type SubmitResult,
  type TelemetryTransport,
} from "@app/telemetry"

/**
 * The transport adapter: one approved payload, one HTTPS request, to a Blink-owned relay.
 *
 * It uses `fetch` rather than a Firebase client SDK on purpose. Firestore, Realtime
 * Database and App Check all attach a device-scoped identifier of their own — an
 * Installations id or an attestation token — and an identifier the receiver can join on is
 * exactly what the payload rules exclude. A bare POST carries no such thing, which is what
 * lets this adapter declare `attachesNoImplicitIdentity`. Analytics is not an option here
 * at all: `logEvent` does nothing while collection is off, and collection is one switch
 * that also turns the SDK's own session and screen events back on.
 *
 * Two obligations remain on the receiver, because no client can enforce them:
 *
 *  - it must deduplicate on `telemetry_event_id`, which is the only id that crosses the
 *    boundary — the local payment key never leaves the device;
 *  - it must not store the request's IP address or anything else the transport reveals
 *    about who sent it.
 *
 * **[ASSUMPTION — the path and the status contract below are backend-owned and not yet
 * served.]** The relay does not exist at the time of writing. Registering this adapter is
 * therefore inert: nothing is queued or drained on a self-custodial device until the
 * rollout flag turns the pipeline on, and that flag is the signal that both halves are
 * ready. Change the constants here, not the callers, when backend names them.
 */
export const TELEMETRY_RELAY_PATH = "/v1/telemetry"

const RELAY_TIMEOUT_MS = 10_000

/** A `Retry-After` longer than this is treated as the cap; the drain has its own ceiling. */
const MAX_RETRY_AFTER_MS = 15 * 60 * 1000

/**
 * What the relay must answer, and what the drain does with it:
 *
 * | status            | result       | effect on the queue                      |
 * |-------------------|--------------|------------------------------------------|
 * | 200, 201, 202     | acknowledged | the record is cleaned, its id tombstoned |
 * | 400, 409, 422     | rejected     | permanent: counted as loss, not retried  |
 * | 429               | retryable    | honours `Retry-After` when it sends one  |
 * | any other status  | retryable    | backs off, expires on the usual schedule |
 * | timeout, offline  | retryable    | same                                     |
 *
 * A 404 is retryable rather than rejected on purpose: "not deployed yet" must not be read
 * as "this event is unwelcome", which would count a deliverable event as lost.
 */
const PERMANENT_REJECTIONS = new Set([400, 409, 422])

const retryAfterFrom = (response: Response): number | undefined => {
  const header = response.headers.get("Retry-After")
  if (!header) return undefined
  const seconds = Number(header)
  if (!Number.isFinite(seconds) || seconds < 0) return undefined
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
}

export const createTelemetryRelayTransport = (baseUrl: string): TelemetryTransport => ({
  name: "blink-relay",
  /** The relay confirms each payload, so the outbox runs its whole state machine. */
  ackSemantics: "application",
  attachesNoImplicitIdentity: true,

  submit: async (payload: ContractPayload): Promise<SubmitResult> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS)
    try {
      const response = await fetch(`${baseUrl}${TELEMETRY_RELAY_PATH}`, {
        method: "POST",
        /** Nothing is added to the payload here. What the policy stage approved is what
         *  goes on the wire, and the envelope carries no device or session fields. */
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (response.ok) return { kind: "acknowledged", ackedAt: Date.now() }
      if (PERMANENT_REJECTIONS.has(response.status)) {
        return { kind: "rejected", reason: `relay refused with ${response.status}` }
      }
      const retryAfterMs = retryAfterFrom(response)
      return retryAfterMs === undefined
        ? { kind: "retryable" }
        : { kind: "retryable", retryAfterMs }
    } catch {
      /** Offline, aborted, or a body we could not even send. The record stays queued. */
      return { kind: "retryable" }
    } finally {
      clearTimeout(timeout)
    }
  },
})
