import { useEffect } from "react"

import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import {
  getStableTokenRestricted,
  withStableTokenRestricted,
  withoutStableTokenRestricted,
} from "@app/store/persistent-state/stable-token-restriction"
import {
  getStablesatsRestricted,
  withStablesatsRestricted,
  withoutStablesatsRestricted,
} from "@app/store/persistent-state/stablesats-restriction"
import { AccountType } from "@app/types/wallet"
import { logRegionRestrictionCleared } from "@app/utils/analytics"

import { isBlockedCountry } from "./use-device-location"
import { useRegistrationCountry } from "./use-registration-country"
import { useActiveWallet } from "./use-active-wallet"

type DollarBalanceRestrictionPolicy = {
  accountType: AccountType
  blockedCountries: string[]
  isPersisted: boolean
  persist: (state: PersistentState) => PersistentState
  clear: (state: PersistentState) => PersistentState
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
      accountType,
      blockedCountries: selfCustodialDollarBalanceBlockedCountries,
      isPersisted: getStableTokenRestricted(persistentState),
      persist: withStableTokenRestricted,
      clear: withoutStableTokenRestricted,
    }
  }
  return {
    accountType,
    blockedCountries: custodialDollarBalanceBlockedCountries,
    isPersisted: getStablesatsRestricted(persistentState),
    persist: withStablesatsRestricted,
    clear: withoutStablesatsRestricted,
  }
}

export const useDollarBalanceRestricted = (): boolean => {
  const { blockedCountries, isPersisted } = useDollarBalanceRestrictionPolicy()
  const { dollarRestrictionCacheEnabled } = useRemoteConfig()
  const { countryCode } = useRegistrationCountry()

  const isCachedRestriction = dollarRestrictionCacheEnabled && isPersisted

  return isCachedRestriction || isBlockedCountry(countryCode, blockedCountries)
}

/**
 * The restriction follows the account's registration country
 * (useRegistrationCountry), never the current IP: a VPN exit country must not
 * flip or latch the restriction (#3907).
 */
export const useDollarBalanceRestrictionSync = (): void => {
  const { accountType, blockedCountries, isPersisted, persist, clear } =
    useDollarBalanceRestrictionPolicy()
  const { dollarRestrictionCacheEnabled, restrictionSelfHealEnabled } = useRemoteConfig()
  const { remoteConfigLoaded } = useFeatureFlags()
  const { countryCode, loading, trusted } = useRegistrationCountry()
  const { updateState } = usePersistentStateContext()

  const blocked = isBlockedCountry(countryCode, blockedCountries)

  const shouldPersist = dollarRestrictionCacheEnabled && !isPersisted && blocked

  /**
   * Clearing needs trustworthy evidence on BOTH sides of the comparison:
   * `loading`/`trusted` guard the unknown-country window, and
   * `remoteConfigLoaded` guards the default blocked lists a failed remote-config
   * fetch leaves behind — a country missing from the defaults must not clear a
   * flag set from the real config. `restrictionSelfHealEnabled` is the remote
   * kill-switch for healing itself (compliance escape hatch). Clearing is
   * deliberately NOT gated on `dollarRestrictionCacheEnabled`: while that
   * kill-switch is active, stale flags heal instead of freezing until the
   * cache is re-enabled.
   */
  const shouldClear =
    isPersisted &&
    restrictionSelfHealEnabled &&
    remoteConfigLoaded &&
    !loading &&
    trusted &&
    !blocked

  /**
   * `persist`/`clear` are in the deps on purpose: their identity flips with
   * accountType, so a custodial-to-self-custodial switch in a blocked country
   * re-fires this effect and writes the self-custodial flag too (anti-bypass
   * double-write on set; symmetric heal on clear).
   */
  useEffect(() => {
    if (shouldPersist) {
      updateState((state) => (state ? persist(state) : state))
    } else if (shouldClear) {
      updateState((state) => (state ? clear(state) : state))
      logRegionRestrictionCleared({
        restriction: "dollar_balance",
        accountType,
        countryCode: countryCode ?? "unknown",
      })
    }
  }, [shouldPersist, shouldClear, persist, clear, updateState, accountType, countryCode])
}
