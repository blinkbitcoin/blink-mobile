import { useRemoteConfig } from "@app/config/feature-flags-context"

import useDeviceLocation from "./use-device-location"
import { useAccountRegistry } from "./use-account-registry"

export type CustodialEligibility = {
  signupAllowed: boolean
  signupBlocked: boolean
  firstSignupBlocked: boolean
  isFirstSignup: boolean
  loading: boolean
}

export const useCustodialEligibility = (): CustodialEligibility => {
  const { countryCode, loading } = useDeviceLocation()
  const { accounts } = useAccountRegistry()
  const { custodialSignupBlockedCountries, custodialFirstSignupBlockedCountries } =
    useRemoteConfig()

  const country = countryCode?.toUpperCase()
  const signupBlocked =
    country !== undefined && custodialSignupBlockedCountries.includes(country)
  const firstSignupBlocked =
    country !== undefined && custodialFirstSignupBlockedCountries.includes(country)

  const isFirstSignup = accounts.length === 0
  const signupAllowed = !signupBlocked && !(firstSignupBlocked && isFirstSignup)

  return {
    signupAllowed,
    signupBlocked,
    firstSignupBlocked,
    isFirstSignup,
    loading,
  }
}
