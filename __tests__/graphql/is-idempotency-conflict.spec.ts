import { ApolloError } from "@apollo/client"

import { isIdempotencyConflict } from "@app/graphql/is-idempotency-conflict"

/** A ServerError-shaped network error: non-2xx with a parsed JSON body. */
const serverError409 = Object.assign(
  new Error("Response not successful: Received status code 409"),
  { statusCode: 409, result: { error: "the idempotency key already exist" } },
)

/** A ServerParseError-shaped network error: the "response was malformed" variant. */
const serverParseError409 = Object.assign(new Error("JSON parse error"), {
  statusCode: 409,
  bodyText: '{"error":"the idempotency key already exist"}',
})

describe("isIdempotencyConflict", () => {
  it("detects an ApolloError wrapping a 409 ServerError", () => {
    expect(isIdempotencyConflict(new ApolloError({ networkError: serverError409 }))).toBe(
      true,
    )
  })

  it("detects an ApolloError wrapping a 409 ServerParseError", () => {
    expect(
      isIdempotencyConflict(new ApolloError({ networkError: serverParseError409 })),
    ).toBe(true)
  })

  it("detects a bare 409 server error", () => {
    expect(isIdempotencyConflict(serverError409)).toBe(true)
  })

  it("falls back to the historical '409: Conflict' message", () => {
    expect(
      isIdempotencyConflict(new Error("HTTP fetch failed from 'galoy': 409: Conflict")),
    ).toBe(true)
  })

  it("falls back to the raw galoy body message", () => {
    expect(
      isIdempotencyConflict(
        new Error(
          "service 'galoy' response was malformed: " +
            '{"error":"the idempotency key already exist"}',
        ),
      ),
    ).toBe(true)
  })

  it("is false for other server errors", () => {
    expect(
      isIdempotencyConflict(
        Object.assign(new Error("Internal server error"), { statusCode: 500 }),
      ),
    ).toBe(false)
  })

  it("is false for a plain network failure", () => {
    expect(isIdempotencyConflict(new Error("Network request failed"))).toBe(false)
  })

  it("is false for a message merely containing 409", () => {
    expect(isIdempotencyConflict(new Error("sent 409 sats"))).toBe(false)
  })

  it("is false for non-Error values", () => {
    expect(isIdempotencyConflict("409: Conflict")).toBe(false)
    expect(isIdempotencyConflict(undefined)).toBe(false)
  })
})
