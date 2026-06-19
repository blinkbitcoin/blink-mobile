import axios from "axios"
import { CountryCode, parsePhoneNumber } from "libphonenumber-js/mobile"
import { useEffect, useState } from "react"

import { useApolloClient } from "@apollo/client"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { useCountryCodeQuery, useSettingsScreenQuery } from "@app/graphql/generated"
import { logError } from "@app/utils/log-error"

const DEFAULT_COUNTRY_CODE: CountryCode = "SV"
const IPAPI_URL = "https://ipapi.co/json/"

export const LocationSource = {
  Phone: "phone",
  Ip: "ip",
} as const

export type LocationSource = (typeof LocationSource)[keyof typeof LocationSource]

export const isBlockedCountry = (
  countryCode: string | undefined,
  blockedCountries: string[],
): boolean => Boolean(countryCode && blockedCountries.includes(countryCode.toUpperCase()))

const fetchCountryFromIp = async (): Promise<CountryCode | undefined> => {
  const { data } = await axios.get(IPAPI_URL, { timeout: 5000 })
  return data?.country_code as CountryCode | undefined
}

const resolveIpCountryCode = async (
  context: Record<string, unknown> = {},
): Promise<CountryCode | undefined> => {
  try {
    const countryCode = await fetchCountryFromIp()
    if (!countryCode) {
      logError({
        scope: "device-location",
        error: new Error("ipapi returned no country"),
        context: { source: "ipapi", ...context },
      })
    }
    return countryCode
  } catch (err) {
    logError({
      scope: "device-location",
      error: err,
      context: { source: "ipapi", ...context },
    })
    return undefined
  }
}

type DeviceLocation = {
  countryCode: CountryCode | undefined
  loading: boolean
  detectionFailed: boolean
  source: LocationSource | undefined
}

const useDeviceLocation = (): DeviceLocation => {
  const client = useApolloClient()
  const { data, error } = useCountryCodeQuery()
  const { data: settingsData } = useSettingsScreenQuery({
    fetchPolicy: "cache-first",
  })

  const [loading, setLoading] = useState(true)
  const [countryCode, setCountryCode] = useState<CountryCode | undefined>()
  const [detectionFailed, setDetectionFailed] = useState(false)
  const [source, setSource] = useState<LocationSource | undefined>()

  const userPhone = settingsData?.me?.phone

  useEffect(() => {
    if (!userPhone) return
    setSource(LocationSource.Phone)
    try {
      const parsed = parsePhoneNumber(userPhone)
      if (!parsed?.country) {
        setCountryCode(DEFAULT_COUNTRY_CODE)
        setDetectionFailed(true)
        setLoading(false)
        logError({
          scope: "device-location",
          error: new Error("phone-parse returned no country, using fallback"),
          context: { source: "phone" },
        })
        return
      }
      setCountryCode(parsed.country)
      setDetectionFailed(false)
      updateCountryCode(client, parsed.country)
    } catch (err) {
      setCountryCode(DEFAULT_COUNTRY_CODE)
      setDetectionFailed(true)
      logError({
        scope: "device-location",
        error: err,
        context: { source: "phone" },
      })
    }
    setLoading(false)
  }, [userPhone, client])

  useEffect(() => {
    if (error && !userPhone) {
      setCountryCode(DEFAULT_COUNTRY_CODE)
      setSource(LocationSource.Ip)
      setDetectionFailed(true)
      setLoading(false)
      logError({
        scope: "device-location",
        error,
        context: { source: "country-code-query" },
      })
    }
  }, [error, userPhone])

  useEffect(() => {
    if (!data || userPhone) return
    setSource(LocationSource.Ip)
    const getLocation = async () => {
      const cached = data.countryCode as CountryCode | undefined
      const ipCountryCode = await resolveIpCountryCode({ hasCached: Boolean(cached) })
      if (ipCountryCode) {
        setCountryCode(ipCountryCode)
        setDetectionFailed(false)
        updateCountryCode(client, ipCountryCode)
      } else {
        setCountryCode(cached ?? DEFAULT_COUNTRY_CODE)
        setDetectionFailed(!cached)
      }
      setLoading(false)
    }
    getLocation()
  }, [data, client, userPhone])

  return {
    countryCode,
    loading,
    detectionFailed,
    source,
  }
}

export const useIpCountryCode = (enabled: boolean): CountryCode | undefined => {
  const [ipCountryCode, setIpCountryCode] = useState<CountryCode | undefined>()

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    resolveIpCountryCode().then((code) => {
      if (active && code) setIpCountryCode(code)
    })
    return () => {
      active = false
    }
  }, [enabled])

  return ipCountryCode
}

export default useDeviceLocation
