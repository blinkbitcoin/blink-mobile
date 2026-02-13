import axios from "axios"
import { CountryCode } from "libphonenumber-js/mobile"
import { useEffect, useState } from "react"

import { useApolloClient } from "@apollo/client"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { useCountryCodeQuery } from "@app/graphql/generated"

const DEFAULT_COUNTRY_CODE: CountryCode = "SV"

const useDeviceLocation = () => {
  const client = useApolloClient()
  const { data, error } = useCountryCodeQuery()

  const [loading, setLoading] = useState(true)
  const [countryCode, setCountryCode] = useState<CountryCode | undefined>()

  // if error this will resort to the default "SV" countryCode
  useEffect(() => {
    if (error) {
      setCountryCode(DEFAULT_COUNTRY_CODE)
      setLoading(false)
    }
  }, [error])

  useEffect(() => {
    if (data) {
      const getLocation = async () => {
        try {
          const response = await axios.get("https://ipapi.co/json/", {
            timeout: 5000,
          })
          const _countryCode = response?.data?.country_code
          if (_countryCode) {
            setCountryCode(_countryCode)
            updateCountryCode(client, _countryCode)
          } else {
            console.warn("no data. default of SV will be used")
            setCountryCode((data.countryCode as CountryCode) ?? DEFAULT_COUNTRY_CODE)
          }
          // can throw a 429 for device's rate-limiting. resort to cached value if available
        } catch (err) {
          setCountryCode((data.countryCode as CountryCode) ?? DEFAULT_COUNTRY_CODE)
        }
        setLoading(false)
      }
      getLocation()
    }
  }, [data, client, setLoading, setCountryCode])

  return {
    countryCode,
    loading,
  }
}

export default useDeviceLocation
