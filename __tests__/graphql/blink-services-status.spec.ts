import { beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  BlinkServicesStatus,
  getBlinkServicesStatus,
  recordBlinkServiceResponse,
  recordBlinkServiceTransportError,
  resetBlinkServicesStatus,
  resetBlinkServicesStatusForTests,
  subscribeToBlinkServicesStatus,
} from "@app/graphql/blink-services-status"

const transportFailure = { message: "Network request failed" } as never
const serverError = { statusCode: 503, message: "Service Unavailable" } as never
const unauthorized = { statusCode: 401, message: "Unauthorized" } as never

describe("blink services status", () => {
  beforeEach(() => {
    resetBlinkServicesStatusForTests()
  })

  it("starts Unknown, because nothing has been attempted", () => {
    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Unknown)
  })

  it("reads Reachable as soon as anything answers", () => {
    recordBlinkServiceResponse()

    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Reachable)
  })

  it("holds on one failure, which is a blip", () => {
    // The transport already retries five times per operation before reporting one.
    recordBlinkServiceTransportError(transportFailure)

    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Unknown)
  })

  it("reads Unreachable on the second consecutive failure", () => {
    recordBlinkServiceTransportError(transportFailure)
    recordBlinkServiceTransportError(transportFailure)

    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Unreachable)
  })

  it("counts a 5xx towards it", () => {
    recordBlinkServiceTransportError(serverError)
    recordBlinkServiceTransportError(serverError)

    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Unreachable)
  })

  it("treats a 4xx as reached, not as an outage", () => {
    // An expired token or a rejected app-check is the server answering. Reporting Blink
    // down for a session that merely needs renewing would be wrong on every screen.
    recordBlinkServiceTransportError(unauthorized)
    recordBlinkServiceTransportError(unauthorized)

    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Reachable)
  })

  it("does not carry a failure across a success", () => {
    // Two failures with a success between them are two blips, not an outage: the
    // counter starts again from the answer.
    recordBlinkServiceTransportError(transportFailure)
    recordBlinkServiceResponse()
    recordBlinkServiceTransportError(transportFailure)

    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Reachable)
  })

  it("recovers to Reachable once something answers again", () => {
    recordBlinkServiceTransportError(transportFailure)
    recordBlinkServiceTransportError(transportFailure)
    recordBlinkServiceResponse()

    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Reachable)
  })

  it("returns to Unknown when the client is rebuilt", () => {
    // A new instance or token is a different connection; the old observations were
    // about something else.
    recordBlinkServiceResponse()
    resetBlinkServicesStatus()

    expect(getBlinkServicesStatus()).toBe(BlinkServicesStatus.Unknown)
  })

  it("notifies subscribers on a change and not on a repeat", () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToBlinkServicesStatus(listener)

    recordBlinkServiceResponse()
    expect(listener).toHaveBeenCalledTimes(1)

    recordBlinkServiceResponse()
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })
})
