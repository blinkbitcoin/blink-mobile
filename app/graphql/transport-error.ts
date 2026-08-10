/**
 * Reading Apollo's error shape without an `instanceof`. Every predicate here is duck-typed
 * on purpose: a second copy of @apollo/client in the bundle makes `instanceof ApolloError`
 * false for a real one, and each of these decides whether an irreversible operation gets
 * replayed, so a missed match is a payment or a deletion sent twice.
 */

const UNAUTHORIZED_STATUS = 401

const propertyOf = (candidate: unknown, property: string): unknown =>
  candidate && typeof candidate === "object" && property in candidate
    ? (candidate as Record<string, unknown>)[property]
    : undefined

/**
 * Whether an Apollo error carries a networkError: the link's signal that the request never
 * became a normal GraphQL response. Usually a dropped connection, but a truthy networkError
 * also covers a ServerError (non-2xx) or ServerParseError, so this errs toward retryable
 * rather than claiming the server never settled. It is the line between offering a retry
 * and handing over.
 */
export const isNetworkFailure = (err: unknown): boolean =>
  Boolean(err instanceof Error && "networkError" in err && err.networkError)

/** The transport's HTTP status, read off either the error itself (what a link hands the
 *  RetryLink) or its networkError (what Apollo hands a caller). Numeric strings are
 *  coerced: a transport surfacing "401" is the same rejection, and returning it unparsed
 *  would fail every comparison below in silence. */
export const statusCodeOf = (err: unknown): number | undefined => {
  const status =
    propertyOf(err, "statusCode") ??
    propertyOf(propertyOf(err, "networkError"), "statusCode")

  if (typeof status === "number") return status
  if (typeof status !== "string") return undefined

  const parsed = Number(status)
  return Number.isInteger(parsed) ? parsed : undefined
}

/** Whether the transport rejected the token. A 401 that slipped into the network branch
 *  would earn a retry that can only 401 again. */
export const isUnauthorizedError = (err: unknown): boolean =>
  statusCodeOf(err) === UNAUTHORIZED_STATUS
