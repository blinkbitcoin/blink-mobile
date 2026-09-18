import { applyLnurlTelemetryFlag } from "./lnurl-telemetry-flag"

/**
 * The kill switch's channel (AD-28, NFR-O4): a Blink-controlled response that established
 * devices refresh on their own schedule, so operations can stop collection on a fleet
 * that is already running — not only on the accounts that happen to call `/recover`.
 *
 * It must not share Remote Config's failure mode, so it rides the LNURL server. An absent
 * endpoint, a failed fetch or a body without the field all change nothing: the switch is
 * one-directional and the last persisted value stands (AD-28).
 *
 * **[ASSUMPTION — the path and the field are backend-owned and not yet served.]** The
 * server has no config route in its current checkout; this is the client's half, and it
 * tolerates a 404 silently until the other half exists. Change the constant, not the
 * callers, when backend names it.
 */
export const LNURL_TELEMETRY_CONFIG_PATH = "/telemetry-config"

/** Once per interval per process, whichever trigger fires — activation or foreground. */
export const TELEMETRY_CONFIG_MIN_INTERVAL_MS = 15 * 60 * 1000

const TELEMETRY_CONFIG_TIMEOUT_MS = 5_000

let lastFetchedAt = 0

/** The request in flight, if any, so two triggers landing together share one. */
let inFlight: Promise<void> | null = null

/**
 * Only an answer starts the interval. A device that was offline for the attempt asks again
 * on its next trigger rather than sitting out fifteen minutes: a kill switch that cannot be
 * retried promptly is the failure AD-28 exists to prevent. A 404 is an answer — not served
 * yet is not a reason to keep asking.
 */
const fetchOnce = async (serverUrl: string, startedAt: number): Promise<void> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TELEMETRY_CONFIG_TIMEOUT_MS)
  try {
    const response = await fetch(`${serverUrl}${LNURL_TELEMETRY_CONFIG_PATH}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    markAnswered(startedAt)
    if (!response.ok) return
    applyLnurlTelemetryFlag(await response.json())
  } catch {
    /** Unreachable. The last persisted value stands, and the next trigger asks again. */
  } finally {
    clearTimeout(timeout)
  }
}

const markAnswered = (at: number): void => {
  lastFetchedAt = at
}

export const refreshTelemetryKillSwitch = (serverUrl: string): Promise<void> => {
  if (inFlight) return inFlight
  const now = Date.now()
  if (now - lastFetchedAt < TELEMETRY_CONFIG_MIN_INTERVAL_MS) return Promise.resolve()
  const request = fetchOnce(serverUrl, now).finally(() => {
    inFlight = null
  })
  inFlight = request
  return request
}

export const resetTelemetryConfigForTesting = (): void => {
  lastFetchedAt = 0
  inFlight = null
}
