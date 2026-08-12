import { CountryCode } from "libphonenumber-js/mobile"

import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  isBlockedCountry,
  useIpCountryLookup,
} from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

/**
 * What an account may not do where it is. The field names are the ones the
 * `custodialRestrictions` query answers, so adopting it later replaces one branch below
 * rather than any caller.
 */
export type Restrictions = {
  dollarBalance: boolean
  transfer: boolean
}

export type AccountRestrictions = Restrictions & {
  /** True once waiting is pointless: the verdict is in, or nothing is left to resolve. */
  isSettled: boolean
}

type BlockedCountries = {
  dollarBalance: string[]
  transfer: string[]
}

/**
 * Pure so the policy can be read without a render, and so both custody types answer to the
 * same rule with only their lists differing. An unresolved country restricts nothing, which
 * is the server's answer too; callers wait on `isSettled` rather than read that as a verdict.
 */
const toRestrictions = (
  countryCode: CountryCode | undefined,
  blockedCountries: BlockedCountries,
): Restrictions => ({
  dollarBalance: isBlockedCountry(countryCode, blockedCountries.dollarBalance),
  transfer: isBlockedCountry(countryCode, blockedCountries.transfer),
})

type RestrictionRegion = {
  countryCode: CountryCode | undefined
  isPending: boolean
}

/**
 * The country whose block-list decides the restriction, resolved once for every feature so
 * a verdict and the flag describing it can never come from different reads.
 *
 * A self-custodial account has no phone, so evaluating its policy resolves by IP; every
 * other case reads the device's own country. The IP wins whenever it resolves, but while
 * predicting the self-custodial policy from a still-custodial session an unreachable IP
 * falls back to the session country, so a failed IP lookup does not read as unrestricted
 * and preview a dollar balance the account cannot hold. A country that already resolved
 * settles the region even while the device location keeps loading, since the prediction's
 * IP lookup can land first. The prediction also holds until the IP lookup settles, or a
 * fast phone parse would report settled-unrestricted and then flip once the IP lands.
 */
const useRestrictionRegion = (isSelfCustodialPrediction: boolean): RestrictionRegion => {
  const { countryCode: deviceCountryCode, loading: isDeviceLocationLoading } =
    useDeviceLocation()
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

/**
 * Every regional restriction an account answers to, from one resolution of one country.
 *
 * Gating on accountType (not isSelfCustodial) keeps the restriction stable through the
 * self-custodial cold-start window while the SDK connects; passing `accountTypeOverride`
 * evaluates a specific type instead (e.g. predicting the self-custodial dollar restriction
 * from the still-custodial session during migration).
 */
export const useAccountRestrictions = (
  accountTypeOverride?: AccountType,
): AccountRestrictions => {
  const { accountType: activeAccountType } = useActiveWallet()
  const {
    custodialDollarBalanceBlockedCountries,
    selfCustodialDollarBalanceBlockedCountries,
    custodialTransferBlockedCountries,
    selfCustodialTransferBlockedCountries,
  } = useRemoteConfig()
  const { remoteConfigReady } = useFeatureFlags()

  const isSelfCustodial =
    (accountTypeOverride ?? activeAccountType) === AccountType.SelfCustodial
  const isSelfCustodialPrediction = accountTypeOverride === AccountType.SelfCustodial
  const { countryCode, isPending: isRegionPending } = useRestrictionRegion(
    isSelfCustodialPrediction,
  )

  /** The custodial half is the server's to answer; a self-custodial wallet has no Blink
   *  account behind it and keeps its own lists. */
  const blockedCountries: BlockedCountries = isSelfCustodial
    ? {
        dollarBalance: selfCustodialDollarBalanceBlockedCountries,
        transfer: selfCustodialTransferBlockedCountries,
      }
    : {
        dollarBalance: custodialDollarBalanceBlockedCountries,
        transfer: custodialTransferBlockedCountries,
      }

  /** An empty list mid-fetch would read as a country nothing restricts, so the fetch is
   *  part of the wait rather than a verdict of its own. */
  const isSettled = !isRegionPending && remoteConfigReady

  return { ...toRestrictions(countryCode, blockedCountries), isSettled }
}
