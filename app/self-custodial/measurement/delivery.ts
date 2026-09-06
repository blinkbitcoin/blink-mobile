import analytics from "@react-native-firebase/analytics"

import { reportError } from "@app/utils/error-logging"

import type { TelemetryPayload } from "./contract"

/**
 * The delivery adapter — the last stage of the pipeline and the only one that touches a
 * transport. Everything above it is transport-agnostic on purpose: OD-1 is not signed, and
 * swapping the transport must not mean rewriting the classifier or the policy.
 *
 * Firebase is the current adapter (option B in the decision memo). It offers no
 * application-level delivery acknowledgment, so the pipeline cannot know an event landed;
 * deduplication happens downstream by grouping on `telemetry_event_id` in BigQuery
 * (FR-26). Raw platform counts must never be read straight off GA4 (FR-27).
 *
 * The persisted outbox (FR-21) is deliberately absent: the memo blocks building one before
 * OD-1 closes, because the retry state machine and cleanup differ per option. Events
 * created while offline are handed to the Firebase SDK, which does its own buffering, and
 * anything it drops is loss the P2 metric contracts must state rather than claim not to
 * have.
 */

export type DeliveryAdapter = (event: string, payload: TelemetryPayload) => void

const firebaseDelivery: DeliveryAdapter = (event, payload) => {
  /** Fire and forget: a telemetry failure must never surface in, or delay, a payment flow. */
  analytics()
    .logEvent(event, payload)
    .catch((err) => {
      reportError(`telemetry delivery: ${event}`, err)
    })
}

let adapter: DeliveryAdapter = firebaseDelivery

export const deliver: DeliveryAdapter = (event, payload) => adapter(event, payload)

/** Seam for the outbox that lands once OD-1 closes, and for tests. */
export const setDeliveryAdapter = (next: DeliveryAdapter): void => {
  adapter = next
}

export const resetDeliveryAdapterForTesting = (): void => {
  adapter = firebaseDelivery
}
