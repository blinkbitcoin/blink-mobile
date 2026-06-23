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
  const { stablesatsTransferBlockedCountries, stableTokenTransferBlockedCountries } =
    useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (accountType === AccountType.SelfCustodial) {
    return {
      blockedCountries: stableTokenTransferBlockedCountries,
      isPersisted: getStableTokenTransferBlocked(persistentState),
      persist: withStableTokenTransferBlocked,
    }
  }
  return {
    blockedCountries: stablesatsTransferBlockedCountries,
    isPersisted: getStablesatsTransferBlocked(persistentState),
    persist: withStablesatsTransferBlocked,
  }
}

export const useTransferBlocked = (): boolean => {
  const { blockedCountries, isPersisted } = useTransferBlockPolicy()
  const { countryCode } = useDeviceLocation()

  return isPersisted || isBlockedCountry(countryCode, blockedCountries)
}

export const useTransferBlockedSync = (): void => {
  const { blockedCountries, isPersisted, persist } = useTransferBlockPolicy()
  const { countryCode, source } = useDeviceLocation()
  const { updateState } = usePersistentStateContext()

  const primaryBlocked = isBlockedCountry(countryCode, blockedCountries)

  const ipCountryCode = useIpCountryCode(
    source === LocationSource.Phone && !isPersisted && !primaryBlocked,
  )

  const shouldPersist =
    !isPersisted && (primaryBlocked || isBlockedCountry(ipCountryCode, blockedCountries))

  /** `persist` is in the deps so an accountType switch re-fires and writes the other flag too (anti-bypass). */
  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? persist(state) : state))
  }, [shouldPersist, persist, updateState])
}
