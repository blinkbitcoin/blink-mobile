import { useEffect } from "react"

import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getStablesatsTransferBlocked,
  withStablesatsTransferBlocked,
  withoutStablesatsTransferBlocked,
} from "@app/store/persistent-state/stablesats-transfer-block"
import {
  getStableTokenTransferBlocked,
  withStableTokenTransferBlocked,
  withoutStableTokenTransferBlocked,
} from "@app/store/persistent-state/stable-token-transfer-block"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountType } from "@app/types/wallet"
import { logRegionRestrictionCleared } from "@app/utils/analytics"

import { isBlockedCountry } from "./use-device-location"
import { useRegistrationCountry } from "./use-registration-country"
import { useActiveWallet } from "./use-active-wallet"

type TransferBlockPolicy = {
  accountType: AccountType
  blockedCountries: string[]
  isPersisted: boolean
  persist: (state: PersistentState) => PersistentState
  clear: (state: PersistentState) => PersistentState
}

/** Gating on accountType (not isSelfCustodial) stays stable through the self-custodial cold-start. */
const useTransferBlockPolicy = (): TransferBlockPolicy => {
  const { accountType } = useActiveWallet()
  const { custodialTransferBlockedCountries, selfCustodialTransferBlockedCountries } =
    useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (accountType === AccountType.SelfCustodial) {
    return {
      accountType,
      blockedCountries: selfCustodialTransferBlockedCountries,
      isPersisted: getStableTokenTransferBlocked(persistentState),
      persist: withStableTokenTransferBlocked,
      clear: withoutStableTokenTransferBlocked,
    }
  }
  return {
    accountType,
    blockedCountries: custodialTransferBlockedCountries,
    isPersisted: getStablesatsTransferBlocked(persistentState),
    persist: withStablesatsTransferBlocked,
    clear: withoutStablesatsTransferBlocked,
  }
}

export const useTransferBlocked = (): boolean => {
  const { blockedCountries, isPersisted } = useTransferBlockPolicy()
  const { dollarRestrictionCacheEnabled } = useRemoteConfig()
  const { countryCode } = useRegistrationCountry()

  const isCachedRestriction = dollarRestrictionCacheEnabled && isPersisted

  return isCachedRestriction || isBlockedCountry(countryCode, blockedCountries)
}

/**
 * The block follows the account's registration country (useRegistrationCountry),
 * never the current IP: a VPN exit country must not flip or latch it (#3907).
 */
export const useTransferBlockedSync = (): void => {
  const { accountType, blockedCountries, isPersisted, persist, clear } =
    useTransferBlockPolicy()
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
   * `persist`/`clear` are in the deps so an accountType switch re-fires and
   * writes the other flag too (anti-bypass double-write on set; symmetric heal
   * on clear).
   */
  useEffect(() => {
    if (shouldPersist) {
      updateState((state) => (state ? persist(state) : state))
    } else if (shouldClear) {
      updateState((state) => (state ? clear(state) : state))
      logRegionRestrictionCleared({
        restriction: "transfer",
        accountType,
        countryCode: countryCode ?? "unknown",
      })
    }
  }, [shouldPersist, shouldClear, persist, clear, updateState, accountType, countryCode])
}
