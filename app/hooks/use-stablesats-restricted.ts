import { useCallback, useEffect, useState } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getStablesatsRestricted,
  withStablesatsRestricted,
} from "@app/store/persistent-state/stablesats-restriction"
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

export const useStablesatsRestricted = (): boolean => {
  const { isSelfCustodial } = useActiveWallet()
  const { countryCode } = useDeviceLocation()
  const { stablesatsBlockedCountries } = useRemoteConfig()
  const { persistentState } = usePersistentStateContext()

  if (isSelfCustodial) return false
  return (
    getStablesatsRestricted(persistentState) ||
    isBlockedCountry(countryCode, stablesatsBlockedCountries)
  )
}

export const useStablesatsRestrictionSync = (): void => {
  const { accountType } = useActiveWallet()
  const { countryCode, source } = useDeviceLocation()
  const { stablesatsBlockedCountries } = useRemoteConfig()
  const { persistentState, updateState } = usePersistentStateContext()

  const isCustodial = accountType === AccountType.Custodial
  const alreadyPersisted = getStablesatsRestricted(persistentState)
  const primaryBlocked = isBlockedCountry(countryCode, stablesatsBlockedCountries)

  const ipCountryCode = useIpCountryCode(
    isCustodial &&
      source === LocationSource.Phone &&
      !alreadyPersisted &&
      !primaryBlocked,
  )

  const shouldPersist =
    isCustodial &&
    !alreadyPersisted &&
    (primaryBlocked || isBlockedCountry(ipCountryCode, stablesatsBlockedCountries))

  useEffect(() => {
    if (!shouldPersist) return
    updateState((state) => (state ? withStablesatsRestricted(state) : state))
  }, [shouldPersist, updateState])
}

export const useStablesatsForcedConversion = ({
  isRestricted,
  usdWalletBalance,
}: {
  isRestricted: boolean
  usdWalletBalance: number
}): { isConvertModalVisible: boolean; closeConvertModal: () => void } => {
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false)
  const hasConvertibleBalance = isRestricted && usdWalletBalance > 0

  useEffect(() => {
    if (hasConvertibleBalance) setIsConvertModalVisible(true)
  }, [hasConvertibleBalance])

  const closeConvertModal = useCallback(() => setIsConvertModalVisible(false), [])

  return { isConvertModalVisible, closeConvertModal }
}
