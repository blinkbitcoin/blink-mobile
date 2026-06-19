import { useEffect } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import {
  getStableTokenRestricted,
  withStableTokenRestricted,
} from "@app/store/persistent-state/stable-token-restriction"
import {
  getStablesatsRestricted,
  withStablesatsRestricted,
} from "@app/store/persistent-state/stablesats-restriction"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  isBlockedCountry,
  LocationSource,
  useIpCountryCode,
} from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

type DollarBalanceRestrictionPolicy = {
  blockedCountries: string[]
  isPersisted: boolean
  persist: (state: PersistentState) => PersistentState
}

/**
 * Gating on accountType (not isSelfCustodial) keeps the restriction stable
 * through the self-custodial cold-start window while the SDK connects.
 */
const useDollarBalanceRestrictionPolicy = (): DollarBalanceRestrictionPolicy => {
  const { accountType } = useActiveWallet()
  const { stablesatsBlockedCountries, stableTokenBlockedCountries } = useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (accountType === AccountType.SelfCustodial) {
    return {
      blockedCountries: stableTokenBlockedCountries,
      isPersisted: getStableTokenRestricted(persistentState),
      persist: withStableTokenRestricted,
    }
  }
  return {
    blockedCountries: stablesatsBlockedCountries,
    isPersisted: getStablesatsRestricted(persistentState),
    persist: withStablesatsRestricted,
  }
}

export const useDollarBalanceRestricted = (): boolean => {
  const { blockedCountries, isPersisted } = useDollarBalanceRestrictionPolicy()
  const { countryCode } = useDeviceLocation()

  return isPersisted || isBlockedCountry(countryCode, blockedCountries)
}

export const useDollarBalanceRestrictionSync = (): void => {
  const { blockedCountries, isPersisted, persist } = useDollarBalanceRestrictionPolicy()
  const { countryCode, source } = useDeviceLocation()
  const { updateState } = usePersistentStateContext()

  const primaryBlocked = isBlockedCountry(countryCode, blockedCountries)

  const ipCountryCode = useIpCountryCode(
    source === LocationSource.Phone && !isPersisted && !primaryBlocked,
  )

  const shouldPersist =
    !isPersisted && (primaryBlocked || isBlockedCountry(ipCountryCode, blockedCountries))

  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? persist(state) : state))
  }, [shouldPersist, persist, updateState])
}
