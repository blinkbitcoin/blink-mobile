import { useRemoteConfig } from "@app/config/feature-flags-context"
import { decideCustodialEligibility } from "@app/utils/custodial-eligibility"

import useDeviceLocation from "./use-device-location"
import { useAccountRegistry } from "./use-account-registry"

export type CustodialEligibility = {
  signupAllowed: boolean
  loading: boolean
}

export const useCustodialEligibility = (): CustodialEligibility => {
  const { countryCode, loading: locationLoading, detectionFailed } = useDeviceLocation()
  const { accounts, loading: registryLoading } = useAccountRegistry()
  const { custodialFirstSignupBlockedCountries } = useRemoteConfig()

  const signupAllowed = decideCustodialEligibility({
    country: countryCode?.toUpperCase(),
    detectionFailed,
    accountCount: accounts.length,
    custodialFirstSignupBlockedCountries,
  })

  return { signupAllowed, loading: locationLoading || registryLoading }
}
