import { ApolloLink } from "@apollo/client"

/**
 * The latest gap (ms) between this device's clock and the server's, from the HTTP `Date`
 * header of every response. The migration commit reads it to tell a proof rejected for a
 * skewed clock (recoverable) from a genuine failure; both drift together, so a reading
 * from seconds ago still holds.
 */
let latestClockSkewMs: number | null = null

const recordServerTime = (dateHeader: string): void => {
  const serverMs = Date.parse(dateHeader)
  if (Number.isNaN(serverMs)) return
  latestClockSkewMs = serverMs - Date.now()
}

/** Afterware that records the server clock from each response's `Date` header. */
export const createServerTimeLink = (): ApolloLink =>
  new ApolloLink((operation, forward) =>
    forward(operation).map((result) => {
      const dateHeader = operation.getContext().response?.headers?.get?.("date")
      if (dateHeader) recordServerTime(dateHeader)
      return result
    }),
  )

/** The backend rejects a proof more than ten minutes off its own clock, so matching that
 *  window (not a smaller one) keeps an unrelated rejection on a merely off clock from
 *  being mislabelled as a clock fault. The reading carries a few seconds of network latency
 *  and the Date header's one-second resolution, negligible against ten minutes and fail-safe. */
const CLOCK_SKEW_LIMIT_MS = 10 * 60 * 1000

export const isDeviceClockSkewed = (): boolean =>
  latestClockSkewMs !== null && Math.abs(latestClockSkewMs) > CLOCK_SKEW_LIMIT_MS

/** Resets the observed skew; for test isolation, never called in production. */
export const resetObservedClockSkew = (): void => {
  latestClockSkewMs = null
}
