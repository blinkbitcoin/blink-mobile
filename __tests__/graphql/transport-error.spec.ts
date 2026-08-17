import { ApolloError } from "@apollo/client"

import {
  isNetworkFailure,
  isUnauthorizedError,
  statusCodeOf,
} from "@app/graphql/transport-error"

/** A ServerError-shaped network error: non-2xx with the status the transport read. */
const serverError = (statusCode: number) =>
  Object.assign(new Error(`Received status code ${statusCode}`), { statusCode })

describe("isNetworkFailure", () => {
  it("matches an error carrying a network error", () => {
    expect(isNetworkFailure(new ApolloError({ networkError: serverError(500) }))).toBe(
      true,
    )
  })

  /** A GraphQL error is the server having answered, which is the line between offering a
   *  retry and handing over. */
  it("is false for an error the server answered with", () => {
    expect(isNetworkFailure(new Error("Not Authorized"))).toBe(false)
  })

  it("is false for an error whose network error is null", () => {
    expect(
      isNetworkFailure(Object.assign(new Error("boom"), { networkError: null })),
    ).toBe(false)
  })

  it("is false for non-Error values", () => {
    expect(isNetworkFailure({ networkError: serverError(500) })).toBe(false)
    expect(isNetworkFailure(undefined)).toBe(false)
  })
})

describe("statusCodeOf", () => {
  it("reads the status off the error itself, as a link hands it to the RetryLink", () => {
    expect(statusCodeOf(serverError(409))).toBe(409)
  })

  it("reads the status off the network error, as Apollo hands it to a caller", () => {
    expect(statusCodeOf(new ApolloError({ networkError: serverError(401) }))).toBe(401)
  })

  it("has nothing to report for an error that carries no status", () => {
    expect(statusCodeOf(new Error("Network request failed"))).toBeUndefined()
    expect(statusCodeOf(null)).toBeUndefined()
  })

  /** A transport that surfaces the status as a string is the same rejection; returning it
   *  unparsed would fail every comparison in silence. */
  it("coerces a status the transport surfaced as a string", () => {
    expect(
      statusCodeOf(Object.assign(new Error("Unauthorized"), { statusCode: "401" })),
    ).toBe(401)
  })

  it("has nothing to report for a status that is not a number at all", () => {
    expect(
      statusCodeOf(Object.assign(new Error("Odd"), { statusCode: "not-a-status" })),
    ).toBeUndefined()
    expect(
      statusCodeOf(Object.assign(new Error("Odd"), { statusCode: { code: 401 } })),
    ).toBeUndefined()
  })
})

describe("isUnauthorizedError", () => {
  it("matches a bare 401", () => {
    expect(isUnauthorizedError(serverError(401))).toBe(true)
  })

  /** A second @apollo/client copy in the bundle makes `instanceof ApolloError` false for a
   *  real one, so nothing here may depend on the instance check. */
  it("matches a 401 on an Apollo-shaped error that fails the instance check", () => {
    expect(
      isUnauthorizedError(
        Object.assign(new Error("Response not successful"), {
          networkError: serverError(401),
        }),
      ),
    ).toBe(true)
  })

  it("is false for another status", () => {
    expect(isUnauthorizedError(serverError(500))).toBe(false)
  })
})
