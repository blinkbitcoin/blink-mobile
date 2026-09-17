import { applyServerKillSwitch } from "@app/telemetry"

/**
 * AD-28's kill switch, as it rides the LNURL server's responses: one boolean field on any
 * body the wallet already parses (`/recover`, `/mode`) and on the dedicated refresh
 * (`/telemetry-config`). `false` engages the switch; `true` and absence change nothing,
 * because it is one-directional.
 *
 * **[ASSUMPTION — the field is backend-owned and not yet served.]** When backend names
 * it, this is the only place that changes.
 */
export const LNURL_TELEMETRY_FLAG_FIELD = "telemetry_enabled"

export const applyLnurlTelemetryFlag = (body: unknown): void => {
  if (!body || typeof body !== "object") return
  const flag = (body as Record<string, unknown>)[LNURL_TELEMETRY_FLAG_FIELD]
  if (typeof flag === "boolean") applyServerKillSwitch(flag)
}
