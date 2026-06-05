import { useRemoteConfig } from "@app/config/feature-flags-context"
import { decideCustodialEligibility } from "@app/utils/custodial-eligibility"

import useDeviceLocation from "./use-device-location"
import { useAccountRegistry } from "./use-account-registry"

export type CustodialEligibility = {
  signupAllowed: boolean
  loading: boolean
}

export const useCustodialEligibility = (): CustodialEligibility => {
  const { countryCode, loading } = useDeviceLocation()
  const { accounts } = useAccountRegistry()
  const { custodialSignupBlockedCountries, custodialFirstSignupBlockedCountries } =
    useRemoteConfig()

  const signupAllowed = decideCustodialEligibility({
    country: countryCode?.toUpperCase(),
    accountCount: accounts.length,
    custodialSignupBlockedCountries,
    custodialFirstSignupBlockedCountries,
  })

  return { signupAllowed, loading }
}
