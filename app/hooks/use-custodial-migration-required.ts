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
import { useAccountRegistry } from "./use-account-registry"

const isBlockedCountry = (
  countryCode: string | undefined,
  blockedCountries: string[],
): boolean => Boolean(countryCode && blockedCountries.includes(countryCode.toUpperCase()))

/**
 * Reads the account type from the registry instead of the active wallet, whose no-account
 * placeholder defaults to Custodial and would latch the forced-migration flag on devices
 * without any account.
 */
const useIsCustodialAccountActive = (): boolean => {
  const { activeAccount } = useAccountRegistry()
  return activeAccount?.type === AccountType.Custodial
}

export const useCustodialMigrationRequired = (): boolean => {
  const isCustodial = useIsCustodialAccountActive()
  const { countryCode } = useDeviceLocation()
  const { custodialMigrationRequiredCountries } = useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (!isCustodial) return false
  return (
    getCustodialMigrationRequired(persistentState) ||
    isBlockedCountry(countryCode, custodialMigrationRequiredCountries)
  )
}

export const useCustodialMigrationRequiredSync = (): void => {
  const isCustodial = useIsCustodialAccountActive()
  const { countryCode, source } = useDeviceLocation()
  const { custodialMigrationRequiredCountries } = useRemoteConfig()
  const { persistentState, updateState } = usePersistentStateContext()
  const isAlreadyPersisted = getCustodialMigrationRequired(persistentState)
  const isPrimaryCountryBlocked = isBlockedCountry(
    countryCode,
    custodialMigrationRequiredCountries,
  )

  const isPhoneLocationSource = source === LocationSource.Phone
  const shouldCheckIpCountry =
    isCustodial &&
    isPhoneLocationSource &&
    !isAlreadyPersisted &&
    !isPrimaryCountryBlocked
  const ipCountryCode = useIpCountryCode(shouldCheckIpCountry)

  const shouldPersist =
    isCustodial &&
    !isAlreadyPersisted &&
    (isPrimaryCountryBlocked ||
      isBlockedCountry(ipCountryCode, custodialMigrationRequiredCountries))

  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? withCustodialMigrationRequired(state) : state))
  }, [shouldPersist, updateState])
}
