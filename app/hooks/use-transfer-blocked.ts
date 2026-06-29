import { useEffect } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getStablesatsTransferBlocked,
  withStablesatsTransferBlocked,
} from "@app/store/persistent-state/stablesats-transfer-block"
import {
  getStableTokenTransferBlocked,
  withStableTokenTransferBlocked,
} from "@app/store/persistent-state/stable-token-transfer-block"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  isBlockedCountry,
  LocationSource,
  useIpCountryCode,
} from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

type TransferBlockPolicy = {
  blockedCountries: string[]
  isPersisted: boolean
  persist: (state: PersistentState) => PersistentState
}

/** Gating on accountType (not isSelfCustodial) stays stable through the self-custodial cold-start. */
const useTransferBlockPolicy = (): TransferBlockPolicy => {
  const { accountType } = useActiveWallet()
  const { custodialTransferBlockedCountries, selfCustodialTransferBlockedCountries } =
    useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (accountType === AccountType.SelfCustodial) {
    return {
      blockedCountries: selfCustodialTransferBlockedCountries,
      isPersisted: getStableTokenTransferBlocked(persistentState),
      persist: withStableTokenTransferBlocked,
    }
  }
  return {
    blockedCountries: custodialTransferBlockedCountries,
    isPersisted: getStablesatsTransferBlocked(persistentState),
    persist: withStablesatsTransferBlocked,
  }
}

export const useTransferBlocked = (): boolean => {
  const { blockedCountries, isPersisted } = useTransferBlockPolicy()
  const { dollarRestrictionCacheEnabled } = useRemoteConfig()
  const { countryCode } = useDeviceLocation()

  const isCachedRestriction = dollarRestrictionCacheEnabled && isPersisted

  return isCachedRestriction || isBlockedCountry(countryCode, blockedCountries)
}

export const useTransferBlockedSync = (): void => {
  const { blockedCountries, isPersisted, persist } = useTransferBlockPolicy()
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

  /** `persist` is in the deps so an accountType switch re-fires and writes the other flag too (anti-bypass). */
  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? persist(state) : state))
  }, [shouldPersist, persist, updateState])
}
