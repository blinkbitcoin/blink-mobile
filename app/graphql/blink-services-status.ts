import React from "react"

import { NetworkError } from "@apollo/client/errors"

/**
 * Whether the Blink backend is answering, observed from the traffic the app already
 * makes rather than from a probe of its own.
 *
 * The app fires several queries in the first second of any screen, so an outage is
 * evident without asking a question whose only purpose is to be asked. A prober would
 * add requests to a service that is, by hypothesis, already struggling.
 *
 * This is about *Blink*, not about the internet. A self-custodial wallet with no
 * connectivity at all is a different condition, reported by the Spark service status in
 * `providers/is-online.ts`, and the two are deliberately separate: Blink can be down
 * while Spark is up, which is the whole case this work exists for.
 */

export const BlinkServicesStatus = {
  /** Something answered. */
  Reachable: "reachable",
  /** Consecutive attempts failed at the transport. */
  Unreachable: "unreachable",
  /** Nothing has been attempted yet this session. */
  Unknown: "unknown",
} as const

export type BlinkServicesStatus =
  (typeof BlinkServicesStatus)[keyof typeof BlinkServicesStatus]

/**
 * One failure is a blip — a dropped connection, a pod restarting mid-request. The
 * transport already retries up to five times per operation before reporting one, so two
 * failed operations is a service that is not answering, not a bad moment.
 */
const FAILURES_BEFORE_UNREACHABLE = 2

let status: BlinkServicesStatus = BlinkServicesStatus.Unknown
let consecutiveFailures = 0
const listeners = new Set<() => void>()

const setStatus = (next: BlinkServicesStatus): void => {
  if (status === next) return
  status = next
  listeners.forEach((listener) => listener())
}

/**
 * A response arrived. GraphQL errors count as reachable: the server answered, it just
 * did not like the question, and this is about reach rather than about correctness.
 */
export const recordBlinkServiceResponse = (): void => {
  consecutiveFailures = 0
  setStatus(BlinkServicesStatus.Reachable)
}

/**
 * A request failed at the transport. A 4xx is not counted: the server answered, and an
 * expired token or a rejected app-check is not an outage — treating it as one would
 * report Blink down for a user whose session merely needs renewing.
 */
export const recordBlinkServiceTransportError = (error: NetworkError): void => {
  const statusCode =
    error && typeof error === "object" && "statusCode" in error
      ? (error as { statusCode?: number }).statusCode
      : undefined
  if (statusCode !== undefined && statusCode < 500) {
    recordBlinkServiceResponse()
    return
  }

  consecutiveFailures += 1
  if (consecutiveFailures >= FAILURES_BEFORE_UNREACHABLE) {
    setStatus(BlinkServicesStatus.Unreachable)
  }
}

/** Called when the Apollo client is rebuilt — a new instance or a new token means the
 *  old observations were about a different connection. */
export const resetBlinkServicesStatus = (): void => {
  consecutiveFailures = 0
  setStatus(BlinkServicesStatus.Unknown)
}

export const subscribeToBlinkServicesStatus = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getBlinkServicesStatus = (): BlinkServicesStatus => status

export const useBlinkServicesStatus = (): BlinkServicesStatus =>
  React.useSyncExternalStore(
    subscribeToBlinkServicesStatus,
    getBlinkServicesStatus,
    getBlinkServicesStatus,
  )

/** Test seam: drops both the status and the listener set. */
export const resetBlinkServicesStatusForTests = (): void => {
  status = BlinkServicesStatus.Unknown
  consecutiveFailures = 0
  listeners.clear()
}
