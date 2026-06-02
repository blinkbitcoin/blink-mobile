import { useRemoteConfig } from "@app/config/feature-flags-context"

import useDeviceLocation from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

export const useStablesatsRestricted = (): boolean => {
  const { isSelfCustodial } = useActiveWallet()
  const { countryCode } = useDeviceLocation()
  const { stablesatsBlockedCountries } = useRemoteConfig()

  if (isSelfCustodial) return false
  if (!countryCode) return false

  return stablesatsBlockedCountries.includes(countryCode.toUpperCase())
}
