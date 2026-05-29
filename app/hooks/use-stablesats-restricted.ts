import { useRemoteConfig } from "@app/config/feature-flags-context"

import useDeviceLocation from "./use-device-location"

export const useStablesatsRestricted = (): boolean => {
  const { countryCode } = useDeviceLocation()
  const { stablesatsBlockedCountries } = useRemoteConfig()

  if (!countryCode) return false

  return stablesatsBlockedCountries.includes(countryCode.toUpperCase())
}
