import { CountryCode } from "libphonenumber-js/mobile"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  isBlockedCountry,
  useIpCountryLookup,
} from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

/**
 * Gating on accountType (not isSelfCustodial) keeps the restriction stable through the
 * self-custodial cold-start window while the SDK connects; passing `accountTypeOverride`
 * evaluates a specific account type's block-list (e.g. predicting the self-custodial
 * dollar restriction from the still-custodial session during migration).
 */
const useDollarBalanceBlockedCountries = (
  accountTypeOverride?: AccountType,
): string[] => {
  const { accountType: activeAccountType } = useActiveWallet()
  const accountType = accountTypeOverride ?? activeAccountType
  const {
    custodialDollarBalanceBlockedCountries,
    selfCustodialDollarBalanceBlockedCountries,
  } = useRemoteConfig()

  return accountType === AccountType.SelfCustodial
    ? selfCustodialDollarBalanceBlockedCountries
    : custodialDollarBalanceBlockedCountries
}

type RestrictionRegion = {
  countryCode: CountryCode | undefined
  isPending: boolean
}

/**
 * The country whose block-list decides the restriction. A self-custodial account has no
 * phone, so evaluating its policy resolves by IP; every other case reads the device's own
 * country. The IP wins whenever it resolves, but while predicting the self-custodial policy
 * from a still-custodial session an unreachable IP falls back to the session country, so a
 * failed IP lookup does not read as unrestricted and preview a dollar balance the account
 * cannot hold. A country that already resolved settles the region even while the device
 * location keeps loading, since the prediction's IP lookup can land first. The prediction
 * also holds until the IP lookup settles, or a fast phone parse would report
 * settled-unrestricted and then flip once the IP lands.
 */
const useRestrictionRegion = (accountTypeOverride?: AccountType): RestrictionRegion => {
  const { countryCode: deviceCountryCode, loading: isDeviceLocationLoading } =
    useDeviceLocation()

  const isSelfCustodialPrediction = accountTypeOverride === AccountType.SelfCustodial
  const { countryCode: ipCountryCode, isSettled: isIpLookupSettled } = useIpCountryLookup(
    isSelfCustodialPrediction,
  )

  const countryCode = isSelfCustodialPrediction
    ? ipCountryCode ?? deviceCountryCode
    : deviceCountryCode

  const isDeviceRegionPending = isDeviceLocationLoading && !countryCode
  const isPredictedRegionPending = isSelfCustodialPrediction && !isIpLookupSettled

  return { countryCode, isPending: isDeviceRegionPending || isPredictedRegionPending }
}

/** `isRestricted` needs a resolved country, so it never accuses an unrestricted user.
 *  Gated surfaces hold on `isRegionPending` instead of reading the unresolved region as
 *  unrestricted, which is what the removed latch used to cover at launch. */
type DollarBalanceRestriction = {
  isRestricted: boolean
  isRegionPending: boolean
}

export const useDollarBalanceRestriction = (
  accountTypeOverride?: AccountType,
): DollarBalanceRestriction => {
  const blockedCountries = useDollarBalanceBlockedCountries(accountTypeOverride)
  const { countryCode, isPending: isRegionPending } =
    useRestrictionRegion(accountTypeOverride)

  return {
    isRestricted: isBlockedCountry(countryCode, blockedCountries),
    isRegionPending,
  }
}

export const useDollarBalanceRestricted = (accountTypeOverride?: AccountType): boolean =>
  useDollarBalanceRestriction(accountTypeOverride).isRestricted
