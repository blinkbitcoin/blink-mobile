import axios from "axios"
import { CountryCode } from "libphonenumber-js/mobile"
import Config from "react-native-config"

import { reportError } from "@app/utils/error-logging"

const DEFAULT_TIMEOUT_MS = 5000

export type IpLookupAdapter = (timeout: number) => Promise<CountryCode | undefined>

// ipinfoAdapter runs first: free tier available without a key (IPINFO_API_KEY raises rate limits)
// Authenticated: api.ipinfo.io/lite + Bearer header → field "country_code"
// Free tier:     ipinfo.io/json (no auth)            → field "country"
const ipinfoAdapter: IpLookupAdapter = async (timeout) => {
  if (Config.IPINFO_API_KEY) {
    const { data } = await axios.get("https://api.ipinfo.io/lite/", {
      headers: { Authorization: `Bearer ${Config.IPINFO_API_KEY}` },
      timeout,
    })
    return data?.country_code as CountryCode | undefined
  }
  const { data } = await axios.get("https://ipinfo.io/json", { timeout })
  return data?.country as CountryCode | undefined
}

// Key-gated adapter — skipped when absent, used before free fallbacks when present
const ipifyAdapter: IpLookupAdapter = async (timeout) => {
  if (!Config.GEO_IPIFY_API_KEY) return undefined
  const { data } = await axios.get(
    `https://geo.ipify.org/api/v2/country?apiKey=${Config.GEO_IPIFY_API_KEY}`,
    { timeout },
  )
  return data?.location?.country as CountryCode | undefined
}

// Free fallback with optional key; response nests data under the detected IP key
// e.g. { "status": "ok", "1.2.3.4": { "location": { "country_code": "SE" } } }
const proxycheckAdapter: IpLookupAdapter = async (timeout) => {
  const url = Config.PROXYCHECK_API_KEY
    ? `https://proxycheck.io/v3/?key=${Config.PROXYCHECK_API_KEY}`
    : "https://proxycheck.io/v3/"
  const { data } = await axios.get(url, { timeout })
  type IpEntry = { location?: { country_code?: string } }
  const ipEntry = Object.values(data as Record<string, IpEntry>).find(
    (v) => v && typeof v === "object" && v.location?.country_code,
  )
  return ipEntry?.location?.country_code as CountryCode | undefined
}

// Free fallback with optional key to avoid rate limits
const ipapiAdapter: IpLookupAdapter = async (timeout) => {
  const url = Config.IPAPI_API_KEY
    ? `https://ipapi.co/json/?key=${Config.IPAPI_API_KEY}`
    : "https://ipapi.co/json/"
  const { data } = await axios.get(url, { timeout })
  return data?.country_code as CountryCode | undefined
}

export const DEFAULT_ADAPTERS: IpLookupAdapter[] = [
  ipinfoAdapter,
  proxycheckAdapter,
  ipifyAdapter,
  ipapiAdapter,
]

if (
  !Config.GEO_IPIFY_API_KEY &&
  !Config.IPINFO_API_KEY &&
  !Config.PROXYCHECK_API_KEY &&
  !Config.IPAPI_API_KEY
) {
  console.warn(
    "[ip-country-lookup] No API key configured. Running on free tiers only (rate-limited). Set GEO_IPIFY_API_KEY, IPINFO_API_KEY, PROXYCHECK_API_KEY, or IPAPI_API_KEY in .env.local.",
  )
}

export const resolveIpCountryCode = async (
  adapters: IpLookupAdapter[] = DEFAULT_ADAPTERS,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<CountryCode | undefined> => {
  for (const adapter of adapters) {
    try {
      const countryCode = await adapter(timeout)
      if (countryCode) return countryCode
    } catch (err) {
      reportError("ip-country-lookup", err)
    }
  }
  return undefined
}

/**
 * Whether the current IP is a known anonymizer (VPN/proxy/Tor exit), from
 * proxycheck.io — the one adapter in the chain whose core product is proxy
 * detection.
 *
 * - `true`  → the IP is a flagged anonymizer
 * - `false` → proxycheck answered and did not flag it
 * - `undefined` → detection unavailable (request failed or fields missing)
 *
 * Callers must treat `undefined` as "no evidence", not as "clean".
 */
export const detectAnonymizingIp = async (
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean | undefined> => {
  try {
    // vpn=1 explicitly requests proxy/VPN detection (v2-documented, harmless on v3)
    const url = Config.PROXYCHECK_API_KEY
      ? `https://proxycheck.io/v3/?key=${Config.PROXYCHECK_API_KEY}&vpn=1`
      : "https://proxycheck.io/v3/?vpn=1"
    const { data } = await axios.get(url, { timeout })
    type Detections = { proxy?: boolean; vpn?: boolean; tor?: boolean }
    type IpEntry = { detections?: Detections; proxy?: string }
    const ipEntry = Object.values(data as Record<string, IpEntry>).find(
      (v) => v && typeof v === "object" && ("detections" in v || "proxy" in v),
    )
    if (!ipEntry) return undefined
    if (ipEntry.detections) {
      return Boolean(
        ipEntry.detections.proxy || ipEntry.detections.vpn || ipEntry.detections.tor,
      )
    }
    // v2-style flat flag
    if (ipEntry.proxy === "yes") return true
    if (ipEntry.proxy === "no") return false
    return undefined
  } catch (err) {
    reportError("ip-country-lookup", err)
    return undefined
  }
}

/** Session cache mirroring resolveIpCountryCodeCached: conclusive answers are cached, `undefined` is retried. */
let sharedAnonymityLookup: Promise<boolean | undefined> | null = null

export const detectAnonymizingIpCached = (): Promise<boolean | undefined> => {
  if (!sharedAnonymityLookup) {
    sharedAnonymityLookup = detectAnonymizingIp().then((result) => {
      if (result === undefined) sharedAnonymityLookup = null
      return result
    })
  }
  return sharedAnonymityLookup
}

/**
 * One shared lookup per app session: the device's country rarely changes
 * mid-session and several screens mount hooks that need it, so the external
 * services are hit once instead of once per mount. A failed lookup is not
 * cached, so a later mount can retry (e.g. the app started offline).
 */
let sharedLookup: Promise<CountryCode | undefined> | null = null

export const resolveIpCountryCodeCached = (): Promise<CountryCode | undefined> => {
  if (!sharedLookup) {
    sharedLookup = resolveIpCountryCode().then((countryCode) => {
      if (!countryCode) sharedLookup = null
      return countryCode
    })
  }
  return sharedLookup
}
