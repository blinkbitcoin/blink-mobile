import { ApolloError } from "@apollo/client"

const CONFLICT_STATUS = 409

/**
 * Matches both the raw galoy body ("the idempotency key already exist") and the
 * historical "409: Conflict" wrapper, for errors where the status code was lost in
 * transit (e.g. re-thrown as a plain Error). Kept tight — no bare "409" — so message
 * text like "409 sats" can never match.
 */
const CONFLICT_MESSAGE_PATTERN = /409:?\s*conflict|idempotency key already exist/i

const statusCodeOf = (candidate: unknown): number | undefined =>
  candidate && typeof candidate === "object" && "statusCode" in candidate
    ? (candidate as { statusCode?: number }).statusCode
    : undefined

/**
 * Whether an error thrown by a payment mutation is the server rejecting a replay of an
 * already-processed request: HTTP 409 on the X-Idempotency-Key. Covers an ApolloError
 * wrapping a ServerError or ServerParseError (both carry statusCode — the parse error is
 * how the "response was malformed" variant surfaces), a bare ServerError/ServerParseError,
 * and a message-pattern fallback. A 409 means the first attempt reached the server, so the
 * payment may well have succeeded despite the thrown error.
 */
export const isIdempotencyConflict = (err: unknown): boolean => {
  if (!(err instanceof Error)) {
    return false
  }
  if (err instanceof ApolloError && statusCodeOf(err.networkError) === CONFLICT_STATUS) {
    return true
  }
  if (statusCodeOf(err) === CONFLICT_STATUS) {
    return true
  }
  return CONFLICT_MESSAGE_PATTERN.test(err.message)
}
