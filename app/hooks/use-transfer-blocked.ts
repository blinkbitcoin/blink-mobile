import { useRemoteConfig } from "@app/config/feature-flags-context"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, { isBlockedCountry } from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

/** Gating on accountType (not isSelfCustodial) stays stable through the self-custodial cold-start. */
const useTransferBlockedCountries = (): string[] => {
  const { accountType } = useActiveWallet()
  const { custodialTransferBlockedCountries, selfCustodialTransferBlockedCountries } =
    useRemoteConfig()

  return accountType === AccountType.SelfCustodial
    ? selfCustodialTransferBlockedCountries
    : custodialTransferBlockedCountries
}

export const useTransferBlocked = (): boolean => {
  const blockedCountries = useTransferBlockedCountries()
  const { countryCode } = useDeviceLocation()

  return isBlockedCountry(countryCode, blockedCountries)
}
