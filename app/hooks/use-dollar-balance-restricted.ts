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
  const {
    custodialDollarBalanceBlockedCountries,
    selfCustodialDollarBalanceBlockedCountries,
  } = useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (accountType === AccountType.SelfCustodial) {
    return {
      blockedCountries: selfCustodialDollarBalanceBlockedCountries,
      isPersisted: getStableTokenRestricted(persistentState),
      persist: withStableTokenRestricted,
    }
  }
  return {
    blockedCountries: custodialDollarBalanceBlockedCountries,
    isPersisted: getStablesatsRestricted(persistentState),
    persist: withStablesatsRestricted,
  }
}

export const useDollarBalanceRestricted = (): boolean => {
  const { blockedCountries, isPersisted } = useDollarBalanceRestrictionPolicy()
  const { countryCode, detectionFailed } = useDeviceLocation()

  return (
    isPersisted || (!detectionFailed && isBlockedCountry(countryCode, blockedCountries))
  )
}

export const useDollarBalanceRestrictionSync = (): void => {
  const { blockedCountries, isPersisted, persist } = useDollarBalanceRestrictionPolicy()
  const { countryCode, source, detectionFailed } = useDeviceLocation()
  const { updateState } = usePersistentStateContext()

  const primaryBlocked =
    !detectionFailed && isBlockedCountry(countryCode, blockedCountries)

  const ipCountryCode = useIpCountryCode(
    source === LocationSource.Phone && !isPersisted && !primaryBlocked,
  )

  const shouldPersist =
    !isPersisted && (primaryBlocked || isBlockedCountry(ipCountryCode, blockedCountries))

  /**
   * `persist` is in the deps on purpose: its identity flips with accountType, so
   * a custodial-to-self-custodial switch in a blocked country re-fires this effect
   * and writes the self-custodial flag too (anti-bypass double-write).
   */
  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? persist(state) : state))
  }, [shouldPersist, persist, updateState])
}
