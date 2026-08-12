import { useCallback } from "react"

import { useApolloClient } from "@apollo/client"
import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { resolveIpCountryCodeCached } from "@app/utils/ip-country-lookup"

import { isBlockedCountry, useIpCountryLookup } from "./use-device-location"

/**
 * The session's region verdict, shaped after the `regionCheck` query that will serve it.
 * Every field here is one the server answers, so adopting it later replaces this body
 * rather than its callers.
 *
 * It speaks only for custodial rules, as that query does: it is resolved from the request
 * IP with no account attached, so it cannot know an account type. A caller that also has a
 * self-custodial rule keeps reading that one for itself.
 */
export type RegionCheckVerdict = {
  /** Undefined until resolved, and in a session that resolves nothing. */
  countryCode: string | undefined
  custodialCreationAllowed: boolean
  restricted: boolean
}

export type RegionCheck = RegionCheckVerdict & {
  /** True once waiting is pointless: the verdict is in, or it will never be asked for. */
  isSettled: boolean
}

/** Nothing was read, so nothing may be held against the user. The server answers the same
 *  way when it cannot resolve a country. */
const UNRESOLVED_VERDICT: RegionCheckVerdict = Object.freeze({
  countryCode: undefined,
  custodialCreationAllowed: true,
  restricted: false,
})

/**
 * One list answers both today, so a country closed to new accounts is also read as
 * sanctioned. The server separates them, and this shape already carries the two fields
 * that will hold the difference.
 */
const toVerdict = (
  resolvedCountry: string,
  custodialCreationBlockedCountries: string[],
): RegionCheckVerdict => {
  /** Uppercased once here, so both access modes answer the same casing and the lists,
   *  which are stored uppercase, are matched the same way. */
  const countryCode = resolvedCountry.toUpperCase()
  const isCountryBlocked = isBlockedCountry(
    countryCode,
    custodialCreationBlockedCountries,
  )

  return {
    countryCode,
    custodialCreationAllowed: !isCountryBlocked,
    restricted: isCountryBlocked,
  }
}

/**
 * Reading the region is the act of locating the user, so a caller with no reason to ask
 * passes false and nothing is resolved. Anon is the standing case.
 */
export const useRegionCheck = (enabled: boolean): RegionCheck => {
  const { custodialCreationBlockedCountries } = useRemoteConfig()
  const { remoteConfigReady } = useFeatureFlags()
  const { countryCode, isSettled: isLookupSettled } = useIpCountryLookup(enabled)

  const verdict = countryCode
    ? toVerdict(countryCode, custodialCreationBlockedCountries)
    : UNRESOLVED_VERDICT

  /** An empty list mid-fetch would read as a country nothing restricts, so the fetch is
   *  part of the wait. A caller that asks nothing has no answer coming, so it never waits. */
  const isVerdictSettled = isLookupSettled && remoteConfigReady
  const isSettled = !enabled || isVerdictSettled

  return { ...verdict, isSettled }
}

/**
 * The same verdict asked for on demand rather than subscribed to, for a caller that must
 * not locate anyone until the user acts. Account creation is the case: the screens it
 * spans read nothing until an option is submitted.
 *
 * The split mirrors the query's own two access modes, so each caller keeps the one it has.
 *
 * One difference is deliberate: the subscribed mode withholds the lookup in Anon, since it
 * speaks for an account that exists and asked not to be located. This one speaks for an
 * account being created, which has no mode of its own yet and cannot inherit another's.
 */
export const useRegionCheckLazy = (): (() => Promise<RegionCheckVerdict>) => {
  const { custodialCreationBlockedCountries } = useRemoteConfig()
  const client = useApolloClient()

  return useCallback(async () => {
    const resolved = await resolveIpCountryCodeCached()
    if (!resolved) return UNRESOLVED_VERDICT

    /** Shared with every other consumer of the country, so one read serves them all. */
    updateCountryCode(client, resolved)

    return toVerdict(resolved, custodialCreationBlockedCountries)
  }, [client, custodialCreationBlockedCountries])
}
