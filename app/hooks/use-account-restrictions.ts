import { useEffect, useState } from "react"

import { CountryCode } from "libphonenumber-js/mobile"

import { gql } from "@apollo/client"
import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { useCustodialRestrictionsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  isBlockedCountry,
  useIpCountryLookup,
} from "./use-device-location"
import { useAccountRegistry } from "./use-account-registry"
import { useActiveWallet } from "./use-active-wallet"

gql`
  query custodialRestrictions {
    custodialRestrictions {
      dollarBalance
      transfer
    }
  }
`

/**
 * What an account may not do where it is. The custodial half is the server's own answer;
 * the field names are its.
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

/** A request that never arrived carries no verdict, but FAIL_CLOSED still has to govern
 *  once asking has genuinely stopped working, so the retries are bounded rather than
 *  endless. Backed off so a server that is down is not hammered by every mounted consumer. */
const RESTRICTION_RETRY_LIMIT = 3
const RESTRICTION_RETRY_BASE_DELAY_MS = 1000

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
    selfCustodialDollarBalanceBlockedCountries,
    selfCustodialTransferBlockedCountries,
  } = useRemoteConfig()
  const { remoteConfigReady } = useFeatureFlags()
  const isAuthed = useIsAuthed()
  /** `useActiveWallet` answers Custodial while the registry hydrates, so a self-custodial
   *  device reads as an unauthed custodial one for those first renders. Reporting settled
   *  there would offer the dollar balance and the transfer button, then withdraw both once
   *  the real account lands. */
  const { loading: isRegistryHydrating } = useAccountRegistry()

  const isSelfCustodial =
    (accountTypeOverride ?? activeAccountType) === AccountType.SelfCustodial
  const isSelfCustodialPrediction = accountTypeOverride === AccountType.SelfCustodial
  const { countryCode, isPending: isRegionPending } = useRestrictionRegion(
    isSelfCustodialPrediction,
  )

  /**
   * The server picks the country this answers for by account level (verified phone for a
   * level 1-2 account, request IP for level 0), so the client never chooses between
   * sources. It speaks only for a Blink account, so a session without one asks nothing.
   */
  const isQueryEnabled = !isSelfCustodial && isAuthed
  const {
    data,
    loading: isQueryLoading,
    error: queryError,
    refetch,
  } = useCustodialRestrictionsQuery({
    skip: !isQueryEnabled,
    /** The verdict follows the account's current standing, and the app re-asks on
     *  foreground, so a cached answer would outlive the session that earned it. */
    fetchPolicy: "no-cache",
  })

  const [retryCount, setRetryCount] = useState(0)
  const hasRetriesLeft = retryCount < RESTRICTION_RETRY_LIMIT

  /**
   * A dropped request and a served "no verdict" are not the same answer, and only the
   * second one is the server speaking. Nothing else re-issues this query inside a session
   * (`no-cache` leaves nothing to re-read, and the only refetch is on foreground), so
   * without this a single lost request would hold its failure until the user backgrounded
   * the app and came back.
   */
  useEffect(() => {
    if (!queryError) {
      setRetryCount(0)
      return undefined
    }
    if (!hasRetriesLeft) return undefined
    const timer = setTimeout(
      () => {
        setRetryCount((count) => count + 1)
        refetch().catch(() => undefined)
      },
      RESTRICTION_RETRY_BASE_DELAY_MS * 2 ** retryCount,
    )
    return () => clearTimeout(timer)
  }, [queryError, hasRetriesLeft, retryCount, refetch])

  /** A self-custodial wallet has no Blink account behind it, so no server verdict covers
   *  it and it keeps its own lists. */
  const selfCustodialBlockedCountries: BlockedCountries = {
    dollarBalance: selfCustodialDollarBalanceBlockedCountries,
    transfer: selfCustodialTransferBlockedCountries,
  }

  if (isSelfCustodial) {
    /** An empty list mid-fetch would read as a country nothing restricts, so the fetch is
     *  part of the wait rather than a verdict of its own. */
    return {
      ...toRestrictions(countryCode, selfCustodialBlockedCountries),
      isSettled: !isRegionPending && remoteConfigReady,
    }
  }

  /** A session with no Blink account has no custodial verdict to receive, so nothing is
   *  gated. It only settles once the registry has named the account, since until then
   *  this reads as custodial-unauthed whatever the account really is. */
  if (!isQueryEnabled) return { ...UNRESTRICTED, isSettled: !isRegistryHydrating }

  /** Held rather than judged while the answer is in flight: the surfaces read
   *  `isRegionPending` and wait, so this value is never shown. */
  if (isQueryLoading) return { ...UNRESTRICTED, isSettled: false }

  /** Still being asked, so still unanswered: the surfaces wait exactly as they do for a
   *  slow reply rather than being told the region is unknown. FAIL_CLOSED applies below,
   *  once the retries are spent and asking has stopped working. */
  const isRetryPending = Boolean(queryError) && hasRetriesLeft
  if (isRetryPending) return { ...UNRESTRICTED, isSettled: false }

  const restrictions = data?.custodialRestrictions ?? RESTRICTED_UNKNOWN_REGION

  return {
    dollarBalance: restrictions.dollarBalance,
    transfer: restrictions.transfer,
    isSettled: true,
  }
}
