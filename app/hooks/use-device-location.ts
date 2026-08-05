import { CountryCode, parsePhoneNumber } from "libphonenumber-js/mobile"
import { useEffect, useMemo, useState } from "react"

import { useApolloClient } from "@apollo/client"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { useCountryCodeQuery, useSettingsScreenQuery } from "@app/graphql/generated"
import { resolveIpCountryCodeCached } from "@app/utils/ip-country-lookup"
import { logError } from "@app/utils/log-error"

const DEFAULT_COUNTRY_CODE: CountryCode = "SV"

export const LocationSource = {
  Phone: "phone",
  Ip: "ip",
} as const

export type LocationSource = (typeof LocationSource)[keyof typeof LocationSource]

export const isBlockedCountry = (
  countryCode: string | undefined,
  blockedCountries: string[],
): boolean => Boolean(countryCode && blockedCountries.includes(countryCode.toUpperCase()))

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
      const ipCountryCode = await resolveIpCountryCodeCached()
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

export const usePhoneCountryCode = (): CountryCode | undefined => {
  const { data } = useSettingsScreenQuery({ fetchPolicy: "cache-first" })
  const phone = data?.me?.phone

  return useMemo(() => {
    if (!phone) return undefined
    try {
      return parsePhoneNumber(phone)?.country
    } catch {
      return undefined
    }
  }, [phone])
}

type IpCountryLookup = {
  countryCode: CountryCode | undefined
  /** True once waiting is pointless: the lookup finished (with or without a country) or
   *  it is disabled and will never run. Gates that hold UI on the lookup read this. */
  isSettled: boolean
}

export const useIpCountryLookup = (enabled: boolean): IpCountryLookup => {
  const [ipCountryCode, setIpCountryCode] = useState<CountryCode | undefined>()
  const [hasLookupFinished, setHasLookupFinished] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIpCountryCode(undefined)
      setHasLookupFinished(false)
      return undefined
    }
    let active = true
    resolveIpCountryCodeCached().then((code) => {
      if (!active) return
      if (code) setIpCountryCode(code)
      setHasLookupFinished(true)
    })
    return () => {
      active = false
    }
  }, [enabled])

  const isLookupSettled = !enabled || hasLookupFinished

  /** Both fields derive from `enabled` in the same render: the effect clears the stored
   *  country a commit later, and returning it in between would leak a stale country as a
   *  settled verdict on the render where the lookup disables. */
  return {
    countryCode: enabled ? ipCountryCode : undefined,
    isSettled: isLookupSettled,
  }
}

export const useIpCountryCode = (enabled: boolean): CountryCode | undefined =>
  useIpCountryLookup(enabled).countryCode

export default useDeviceLocation
