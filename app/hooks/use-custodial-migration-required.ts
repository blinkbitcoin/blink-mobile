import { useEffect } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getCustodialMigrationRequired,
  withCustodialMigrationRequired,
} from "@app/store/persistent-state/custodial-migration-required"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  LocationSource,
  useIpCountryCode,
} from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

const isBlockedCountry = (
  countryCode: string | undefined,
  blockedCountries: string[],
): boolean => Boolean(countryCode && blockedCountries.includes(countryCode.toUpperCase()))

export const useCustodialMigrationRequired = (): boolean => {
  const { accountType } = useActiveWallet()
  const { countryCode } = useDeviceLocation()
  const { custodialMigrationRequiredCountries } = useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (accountType !== AccountType.Custodial) return false
  return (
    getCustodialMigrationRequired(persistentState) ||
    isBlockedCountry(countryCode, custodialMigrationRequiredCountries)
  )
}

export const useCustodialMigrationRequiredSync = (): void => {
  const { accountType } = useActiveWallet()
  const { countryCode, source } = useDeviceLocation()
  const { custodialMigrationRequiredCountries } = useRemoteConfig()
  const { persistentState, updateState } = usePersistentStateContext()

  const isCustodial = accountType === AccountType.Custodial
  const alreadyPersisted = getCustodialMigrationRequired(persistentState)
  const primaryBlocked = isBlockedCountry(
    countryCode,
    custodialMigrationRequiredCountries,
  )

  const ipCountryCode = useIpCountryCode(
    isCustodial &&
      source === LocationSource.Phone &&
      !alreadyPersisted &&
      !primaryBlocked,
  )

  const shouldPersist =
    isCustodial &&
    !alreadyPersisted &&
    (primaryBlocked ||
      isBlockedCountry(ipCountryCode, custodialMigrationRequiredCountries))

  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? withCustodialMigrationRequired(state) : state))
  }, [shouldPersist, updateState])
}
