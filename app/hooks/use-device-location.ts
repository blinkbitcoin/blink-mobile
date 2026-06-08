import axios from "axios"
import { CountryCode, parsePhoneNumber } from "libphonenumber-js/mobile"
import { useEffect, useState } from "react"

import { useApolloClient } from "@apollo/client"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { useCountryCodeQuery, useSettingsScreenQuery } from "@app/graphql/generated"
import { logError } from "@app/utils/log-error"

const DEFAULT_COUNTRY_CODE: CountryCode = "SV"
const IPAPI_URL = "https://ipapi.co/json/"

type DeviceLocation = {
  countryCode: CountryCode | undefined
  loading: boolean
  detectionFailed: boolean
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

  const userPhone = settingsData?.me?.phone

  useEffect(() => {
    if (!userPhone) return
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
    const getLocation = async () => {
      try {
        const response = await axios.get(IPAPI_URL, {
          timeout: 5000,
        })
        const _countryCode = response?.data?.country_code
        if (!_countryCode) {
          const cached = data.countryCode as CountryCode | undefined
          setCountryCode(cached ?? DEFAULT_COUNTRY_CODE)
          setDetectionFailed(!cached)
          setLoading(false)
          logError({
            scope: "device-location",
            error: new Error("ipapi returned no country, using cached or fallback"),
            context: { source: "ipapi", hasCached: Boolean(cached) },
          })
          return
        }
        setCountryCode(_countryCode)
        setDetectionFailed(false)
        updateCountryCode(client, _countryCode)
      } catch (err) {
        const cached = data.countryCode as CountryCode | undefined
        setCountryCode(cached ?? DEFAULT_COUNTRY_CODE)
        setDetectionFailed(!cached)
        logError({
          scope: "device-location",
          error: err,
          context: { source: "ipapi", hasCached: Boolean(cached) },
        })
      }
      setLoading(false)
    }
    getLocation()
  }, [data, client, userPhone])

  return {
    countryCode,
    loading,
    detectionFailed,
  }
}

export default useDeviceLocation
