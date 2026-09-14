import axios from "axios"
import { CountryCode } from "libphonenumber-js/mobile"
import Config from "react-native-config"

import { reportError } from "@app/utils/error-logging"

const DEFAULT_TIMEOUT_MS = 5000

export type IpLookupAdapter = (timeout: number) => Promise<CountryCode | undefined>

// ipinfoAdapter runs first: free tier available without a key (IPINFO_API_KEY raises rate limits)
// Authenticated: api.ipinfo.io/lite/me + Bearer header → field "country_code"
// Free tier:     ipinfo.io/json (no auth)               → field "country"
// The /me segment is required: api.ipinfo.io/lite/ (no IP) is not a real endpoint and
// returns a 404, which would drop this adapter and let the country default to a fallback.
const ipinfoAdapter: IpLookupAdapter = async (timeout) => {
  if (Config.IPINFO_API_KEY) {
    const { data } = await axios.get("https://api.ipinfo.io/lite/me", {
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
 * One shared lookup per session: the device's country rarely changes within one, and
 * several screens mount hooks that need it, so the external services are hit once
 * instead of once per mount. A failed lookup is not cached, so a later mount can retry
 * (e.g. the app started offline).
 *
 * A session is not the JS process. The region a session runs under is the one its
 * connection resolves to, so this is dropped whenever a new session starts
 * (`resetIpCountryLookup`) and the next consumer resolves afresh. Held for the process
 * instead, a user who changed network would keep the country they launched on until they
 * killed the app.
 */
let sharedLookup: Promise<CountryCode | undefined> | null = null

/**
 * Bumped by every reset. Hooks read it so a reset re-runs their effect: clearing the
 * promise alone only serves consumers that mount afterwards, and a screen already on
 * display would keep the country it resolved a session ago.
 */
let lookupGeneration = 0

const generationSubscribers = new Set<() => void>()

/** `useSyncExternalStore` pair, so a reset re-renders the hooks reading the country
 *  rather than only affecting whatever mounts next. */
export const subscribeToIpCountryLookup = (onChange: () => void): (() => void) => {
  generationSubscribers.add(onChange)
  return () => {
    generationSubscribers.delete(onChange)
  }
}

export const getIpCountryLookupGeneration = (): number => lookupGeneration

/**
 * Drops the shared lookup so the next consumer resolves against the current connection.
 * Called at each session start; it issues no request of its own, so a mode that resolves
 * nothing (Anon) stays unaffected.
 */
export const resetIpCountryLookup = (): void => {
  sharedLookup = null
  lookupGeneration += 1
  generationSubscribers.forEach((onChange) => onChange())
}

export const resolveIpCountryCodeCached = (): Promise<CountryCode | undefined> => {
  if (!sharedLookup) {
    /** Captured so a lookup still in flight when a reset lands cannot clear the promise
     *  its successor installed, which would spend another round of rate-limited calls. */
    const generation = lookupGeneration
    const clearIfCurrent = () => {
      if (generation === lookupGeneration) sharedLookup = null
    }

    sharedLookup = resolveIpCountryCode()
      .then((countryCode) => {
        if (!countryCode) clearIfCurrent()
        return countryCode
      })
      /** resolveIpCountryCode only rejects if error reporting itself throws, but a
       *  rejection must never stay cached: consumers gate UI on this promise settling,
       *  and a cached rejection would poison every later mount for the whole session. */
      .catch(() => {
        clearIfCurrent()
        return undefined
      })
  }
  return sharedLookup
}
