import axios from "axios"
import { CountryCode, parsePhoneNumber } from "libphonenumber-js/mobile"
import { useEffect, useState } from "react"

import { useApolloClient } from "@apollo/client"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { useCountryCodeQuery, useSettingsScreenQuery } from "@app/graphql/generated"

const DEFAULT_COUNTRY_CODE: CountryCode = "SV"
const IPAPI_URL = "https://ipapi.co/json/"

const useDeviceLocation = () => {
  const client = useApolloClient()
  const { data, error } = useCountryCodeQuery()
  const { data: settingsData } = useSettingsScreenQuery({
    fetchPolicy: "cache-first",
  })

  const [loading, setLoading] = useState(true)
  const [countryCode, setCountryCode] = useState<CountryCode | undefined>()

  const userPhone = settingsData?.me?.phone

  useEffect(() => {
    if (!userPhone) return
    const parsed = parsePhoneNumber(userPhone)
    if (!parsed?.country) return
    setCountryCode(parsed.country)
    updateCountryCode(client, parsed.country)
    setLoading(false)
  }, [userPhone, client])

  // if error this will resort to the default "SV" countryCode
  useEffect(() => {
    if (error && !userPhone) {
      setCountryCode(DEFAULT_COUNTRY_CODE)
      setLoading(false)
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
          console.warn("no data. default of SV will be used")
          setCountryCode((data.countryCode as CountryCode) ?? DEFAULT_COUNTRY_CODE)
          setLoading(false)
          return
        }
        setCountryCode(_countryCode)
        updateCountryCode(client, _countryCode)
        // can throw a 429 for device's rate-limiting. resort to cached value if available
      } catch (err) {
        setCountryCode((data.countryCode as CountryCode) ?? DEFAULT_COUNTRY_CODE)
      }
      setLoading(false)
    }
    getLocation()
  }, [data, client, userPhone])

  return {
    countryCode,
    loading,
  }
}

export default useDeviceLocation
