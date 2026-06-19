import { useEffect } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getStableTokenTransferBlocked,
  withStableTokenTransferBlocked,
} from "@app/store/persistent-state/stable-token-transfer-block"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  isBlockedCountry,
  LocationSource,
  useIpCountryCode,
} from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

export const useStableTokenTransferBlocked = (): boolean => {
  const { accountType } = useActiveWallet()
  const { countryCode } = useDeviceLocation()
  const { stableTokenTransferBlockedCountries } = useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (accountType !== AccountType.SelfCustodial) return false
  return (
    getStableTokenTransferBlocked(persistentState) ||
    isBlockedCountry(countryCode, stableTokenTransferBlockedCountries)
  )
}

export const useStableTokenTransferBlockedSync = (): void => {
  const { accountType } = useActiveWallet()
  const { countryCode, source } = useDeviceLocation()
  const { stableTokenTransferBlockedCountries } = useRemoteConfig()
  const { persistentState, updateState } = usePersistentStateContext()

  const isSelfCustodial = accountType === AccountType.SelfCustodial
  const alreadyPersisted = getStableTokenTransferBlocked(persistentState)
  const primaryBlocked = isBlockedCountry(
    countryCode,
    stableTokenTransferBlockedCountries,
  )

  const ipCountryCode = useIpCountryCode(
    isSelfCustodial &&
      source === LocationSource.Phone &&
      !alreadyPersisted &&
      !primaryBlocked,
  )

  const shouldPersist =
    isSelfCustodial &&
    !alreadyPersisted &&
    (primaryBlocked ||
      isBlockedCountry(ipCountryCode, stableTokenTransferBlockedCountries))

  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? withStableTokenTransferBlocked(state) : state))
  }, [shouldPersist, updateState])
}
