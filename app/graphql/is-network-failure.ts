/**
 * Whether an Apollo error carries a networkError: the link's signal that the request never
 * became a normal GraphQL response. Usually a dropped connection, but a truthy networkError
 * also covers a ServerError (non-2xx) or ServerParseError, so this errs toward retryable
 * rather than claiming the server never settled. It is the line between offering a retry
 * and handing over.
 */
export const isNetworkFailure = (err: unknown): boolean =>
  Boolean(err instanceof Error && "networkError" in err && err.networkError)
