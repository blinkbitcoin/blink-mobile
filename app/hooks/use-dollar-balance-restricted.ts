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
 * Gating on accountType (not isSelfCustodial) keeps the restriction stable through the
 * self-custodial cold-start window while the SDK connects; passing `accountTypeOverride`
 * evaluates a specific account type's policy (e.g. predicting the self-custodial dollar
 * restriction from the still-custodial session during migration).
 */
const useDollarBalanceRestrictionPolicy = (
  accountTypeOverride?: AccountType,
): DollarBalanceRestrictionPolicy => {
  const { accountType: activeAccountType } = useActiveWallet()
  const accountType = accountTypeOverride ?? activeAccountType
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

export const useDollarBalanceRestricted = (
  accountTypeOverride?: AccountType,
): boolean => {
  const { blockedCountries, isPersisted } =
    useDollarBalanceRestrictionPolicy(accountTypeOverride)
  const { dollarRestrictionCacheEnabled } = useRemoteConfig()
  const { countryCode } = useDeviceLocation()

  const isCachedRestriction = dollarRestrictionCacheEnabled && isPersisted

  return isCachedRestriction || isBlockedCountry(countryCode, blockedCountries)
}

export const useDollarBalanceRestrictionSync = (): void => {
  const { blockedCountries, isPersisted, persist } = useDollarBalanceRestrictionPolicy()
  const { dollarRestrictionCacheEnabled } = useRemoteConfig()
  const { countryCode, source } = useDeviceLocation()
  const { updateState } = usePersistentStateContext()

  const canPersistRestriction = dollarRestrictionCacheEnabled && !isPersisted
  const primaryBlocked = isBlockedCountry(countryCode, blockedCountries)
  const isPhoneSource = source === LocationSource.Phone

  const shouldConsultIp = canPersistRestriction && isPhoneSource && !primaryBlocked

  const ipCountryCode = useIpCountryCode(shouldConsultIp)

  const shouldPersist =
    canPersistRestriction &&
    (primaryBlocked || isBlockedCountry(ipCountryCode, blockedCountries))

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
