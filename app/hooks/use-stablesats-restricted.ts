import { useEffect } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getStablesatsRestricted,
  withStablesatsRestricted,
} from "@app/store/persistent-state/stablesats-restriction"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

const isBlockedCountry = (
  countryCode: string | undefined,
  blockedCountries: string[],
): boolean => Boolean(countryCode && blockedCountries.includes(countryCode.toUpperCase()))

export const useStablesatsRestricted = (): boolean => {
  const { isSelfCustodial } = useActiveWallet()
  const { countryCode } = useDeviceLocation()
  const { stablesatsBlockedCountries } = useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (isSelfCustodial) return false
  return (
    getStablesatsRestricted(persistentState) ||
    isBlockedCountry(countryCode, stablesatsBlockedCountries)
  )
}

export const useStablesatsRestrictionSync = (): void => {
  const { accountType } = useActiveWallet()
  const { countryCode } = useDeviceLocation()
  const { stablesatsBlockedCountries } = useRemoteConfig()
  const { persistentState, updateState } = usePersistentStateContext()

  const shouldPersist =
    accountType === AccountType.Custodial &&
    isBlockedCountry(countryCode, stablesatsBlockedCountries) &&
    !getStablesatsRestricted(persistentState)

  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? withStablesatsRestricted(state) : state))
  }, [shouldPersist, updateState])
}
