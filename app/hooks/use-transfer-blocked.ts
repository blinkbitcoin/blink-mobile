import { useRemoteConfig } from "@app/config/feature-flags-context"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, { isBlockedCountry } from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"
import { useSelfCustodialAccountMode } from "./use-self-custodial-account-mode"

/** Gating on accountType (not isSelfCustodial) stays stable through the self-custodial cold-start. */
const useTransferBlockedCountries = (): string[] => {
  const { accountType } = useActiveWallet()
  const { custodialTransferBlockedCountries, selfCustodialTransferBlockedCountries } =
    useRemoteConfig()

  return accountType === AccountType.SelfCustodial
    ? selfCustodialTransferBlockedCountries
    : custodialTransferBlockedCountries
}

/** `isGated` needs a resolved country, so it never ejects an allowed user. Surfaces hold
 *  on `isRegionPending` instead of reading the unresolved region as allowed, which is what
 *  the removed latch used to cover at launch. Anon resolves no region, so nothing pends
 *  there: the mode gates on its own. */
type TransferGate = {
  isGated: boolean
  isRegionPending: boolean
}

/** The availability gate: Anon gates transfers by itself, region otherwise. Availability
 *  surfaces and guards read this, the sole public gate. */
export const useTransferGate = (): TransferGate => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const blockedCountries = useTransferBlockedCountries()
  const { countryCode, loading: isRegionPending } = useDeviceLocation()

  return {
    isGated: isAnonMode || isBlockedCountry(countryCode, blockedCountries),
    isRegionPending,
  }
}

export const useTransferGated = (): boolean => useTransferGate().isGated
