import axios from "axios"
import { CountryCode } from "libphonenumber-js/mobile"
import Config from "react-native-config"

import { reportError } from "@app/utils/error-logging"

export type IpLookupAdapter = () => Promise<CountryCode | undefined>

// Paid/key-gated adapters — skipped when the key is absent, used first when present

const ipifyAdapter: IpLookupAdapter = async () => {
  if (!Config.GEO_IPIFY_API_KEY) return undefined
  const { data } = await axios.get(
    `https://geo.ipify.org/api/v2/country?apiKey=${Config.GEO_IPIFY_API_KEY}`,
    { timeout: 5000 },
  )
  return data?.location?.country as CountryCode | undefined
}

const ipinfoAdapter: IpLookupAdapter = async () => {
  if (!Config.IPINFO_API_KEY) return undefined
  const { data } = await axios.get(
    `https://ipinfo.io/json?token=${Config.IPINFO_API_KEY}`,
    { timeout: 5000 },
  )
  return data?.country as CountryCode | undefined
}

// Free adapters — no key required, used as fallback

const ipapiAdapter: IpLookupAdapter = async () => {
  const url = Config.IPAPI_API_KEY
    ? `https://ipapi.co/json/?key=${Config.IPAPI_API_KEY}`
    : "https://ipapi.co/json/"
  const { data } = await axios.get(url, { timeout: 5000 })
  return data?.country_code as CountryCode | undefined
}

export const DEFAULT_ADAPTERS: IpLookupAdapter[] = [
  ipifyAdapter,
  ipinfoAdapter,
  ipapiAdapter,
]

export const resolveIpCountryCode = async (
  adapters: IpLookupAdapter[] = DEFAULT_ADAPTERS,
): Promise<CountryCode | undefined> => {
  for (const adapter of adapters) {
    try {
      const countryCode = await adapter()
      if (countryCode) return countryCode
    } catch (err) {
      reportError("ip-country-lookup", err)
    }
  }
  return undefined
}
