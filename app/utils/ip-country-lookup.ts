import axios from "axios"
import { CountryCode } from "libphonenumber-js/mobile"
import Config from "react-native-config"

import { reportError } from "@app/utils/error-logging"

const DEFAULT_TIMEOUT_MS = 5000

export type IpLookupAdapter = (timeout: number) => Promise<CountryCode | undefined>

// Paid/key-gated adapters — skipped when the key is absent, used first when present

const ipifyAdapter: IpLookupAdapter = async (timeout) => {
  if (!Config.GEO_IPIFY_API_KEY) return undefined
  const { data } = await axios.get(
    `https://geo.ipify.org/api/v2/country?apiKey=${Config.GEO_IPIFY_API_KEY}`,
    { timeout },
  )
  return data?.location?.country as CountryCode | undefined
}

const ipinfoAdapter: IpLookupAdapter = async (timeout) => {
  if (!Config.IPINFO_API_KEY) return undefined
  const { data } = await axios.get(
    `https://ipinfo.io/json?token=${Config.IPINFO_API_KEY}`,
    { timeout },
  )
  return data?.country as CountryCode | undefined
}

// Free adapters — no key required, used as fallback

const ipapiAdapter: IpLookupAdapter = async (timeout) => {
  const url = Config.IPAPI_API_KEY
    ? `https://ipapi.co/json/?key=${Config.IPAPI_API_KEY}`
    : "https://ipapi.co/json/"
  const { data } = await axios.get(url, { timeout })
  return data?.country_code as CountryCode | undefined
}

export const DEFAULT_ADAPTERS: IpLookupAdapter[] = [
  ipifyAdapter,
  ipinfoAdapter,
  ipapiAdapter,
]

if (!Config.GEO_IPIFY_API_KEY && !Config.IPINFO_API_KEY && !Config.IPAPI_API_KEY) {
  console.warn(
    "[ip-country-lookup] No API key configured. Falling back to ipapi.co free tier, which is rate-limited. Set GEO_IPIFY_API_KEY, IPINFO_API_KEY, or IPAPI_API_KEY in .env.local.",
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
