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

/** `isBlocked` needs a resolved country, so it never ejects an allowed user. Gated
 *  surfaces hold on `isRegionPending` instead of reading the unresolved region as
 *  allowed, which is what the removed latch used to cover at launch. */
type TransferBlock = {
  isBlocked: boolean
  isRegionPending: boolean
}

export const useTransferBlock = (): TransferBlock => {
  const blockedCountries = useTransferBlockedCountries()
  const { countryCode, loading: isRegionPending } = useDeviceLocation()

  return { isBlocked: isBlockedCountry(countryCode, blockedCountries), isRegionPending }
}

export const useTransferBlocked = (): boolean => useTransferBlock().isBlocked
