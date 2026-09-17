import { applyServerKillSwitch } from "@app/telemetry"

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

type TelemetryConfigBody = {
  telemetry_enabled?: boolean // eslint-disable-line camelcase
}

export const refreshTelemetryKillSwitch = async (serverUrl: string): Promise<void> => {
  const now = Date.now()
  if (now - lastFetchedAt < TELEMETRY_CONFIG_MIN_INTERVAL_MS) return
  lastFetchedAt = now

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TELEMETRY_CONFIG_TIMEOUT_MS)
  try {
    const response = await fetch(`${serverUrl}${LNURL_TELEMETRY_CONFIG_PATH}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    if (!response.ok) return
    const body = (await response.json()) as TelemetryConfigBody
    if (typeof body.telemetry_enabled === "boolean") {
      applyServerKillSwitch(body.telemetry_enabled)
    }
  } catch {
    /** Unreachable, or not served yet. The last persisted value stands. */
  } finally {
    clearTimeout(timeout)
  }
}

export const resetTelemetryConfigForTesting = (): void => {
  lastFetchedAt = 0
}
