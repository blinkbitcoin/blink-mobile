import { CountryCode } from "libphonenumber-js/mobile"

import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { useCustodialRestrictions } from "@app/custodial/providers/restrictions"
import {
  Restrictions,
  RestrictionVerdict,
  RestrictionVerdictStatus,
} from "@app/types/account"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  isBlockedCountry,
  useIpCountryLookup,
} from "./use-device-location"
import { useAccountRegistry } from "./use-account-registry"
import { useActiveWallet } from "./use-active-wallet"

export type AccountRestrictions = Restrictions & {
  /** True once waiting is pointless: the verdict is in, or nothing is left to resolve. */
  isSettled: boolean
  /**
   * True only when a region decided the verdict: the server answered, or the device
   * resolved a country. An unanswered question still gates by policy but proves nothing
   * about where the user is, so an action taken on the user's funds requires this.
   */
  isRegionDetermined: boolean
}

type BlockedCountries = {
  dollarBalance: string[]
  transfer: string[]
}

/** What a session with no Blink account behind it answers to: there is nothing to gate. */
const UNRESTRICTED: Restrictions = Object.freeze({
  dollarBalance: false,
  transfer: false,
})

/** A gated feature requires a determined region, and an unanswered query determined none.
 *  `UnknownRegionPolicy = FAIL_CLOSED` per the PRD's P0 values: no region, no gated
 *  feature, regardless of why there is no region. */
const RESTRICTED_UNKNOWN_REGION: Restrictions = Object.freeze({
  dollarBalance: true,
  transfer: true,
})

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

/**
 * The custodial half is the server's own answer. A session with no Blink account only
 * settles once the registry has named the account, since until then it reads as
 * custodial-unauthed whatever the account really is.
 */
const fromCustodialVerdict = (
  verdict: RestrictionVerdict,
  isRegistryHydrating: boolean,
): AccountRestrictions => {
  switch (verdict.status) {
    case RestrictionVerdictStatus.NoAccount:
      return {
        ...UNRESTRICTED,
        isSettled: !isRegistryHydrating,
        isRegionDetermined: false,
      }
    case RestrictionVerdictStatus.Pending:
      return { ...UNRESTRICTED, isSettled: false, isRegionDetermined: false }
    case RestrictionVerdictStatus.Served:
      return { ...verdict.restrictions, isSettled: true, isRegionDetermined: true }
    case RestrictionVerdictStatus.Unknown:
      return { ...RESTRICTED_UNKNOWN_REGION, isSettled: true, isRegionDetermined: false }
  }
}

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
    selfCustodialDollarBalanceBlockedCountries,
    selfCustodialTransferBlockedCountries,
  } = useRemoteConfig()
  const { remoteConfigReady } = useFeatureFlags()
  /** `useActiveWallet` answers Custodial while the registry hydrates, so a self-custodial
   *  device reads as an unauthed custodial one for those first renders. Reporting settled
   *  there would offer the dollar balance and the transfer button, then withdraw both once
   *  the real account lands. */
  const { loading: isRegistryHydrating } = useAccountRegistry()
  const { verdict: custodialVerdict } = useCustodialRestrictions()

  const isSelfCustodial =
    (accountTypeOverride ?? activeAccountType) === AccountType.SelfCustodial
  const isSelfCustodialPrediction = accountTypeOverride === AccountType.SelfCustodial
  const { countryCode, isPending: isRegionPending } = useRestrictionRegion(
    isSelfCustodialPrediction,
  )

  if (!isSelfCustodial) return fromCustodialVerdict(custodialVerdict, isRegistryHydrating)

  /** A self-custodial wallet has no Blink account behind it, so no server verdict covers
   *  it and it keeps its own lists. An empty list mid-fetch would read as a country nothing
   *  restricts, so the fetch is part of the wait rather than a verdict of its own. */
  const selfCustodialBlockedCountries: BlockedCountries = {
    dollarBalance: selfCustodialDollarBalanceBlockedCountries,
    transfer: selfCustodialTransferBlockedCountries,
  }

  return {
    ...toRestrictions(countryCode, selfCustodialBlockedCountries),
    isSettled: !isRegionPending && remoteConfigReady,
    isRegionDetermined: countryCode !== undefined,
  }
}
