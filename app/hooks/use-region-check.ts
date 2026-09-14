import { useCallback } from "react"

import { gql, useApolloClient } from "@apollo/client"
import { updateCountryCode } from "@app/graphql/client-only-query"
import {
  RegionCheckDocument,
  RegionCheckQuery,
  useRegionCheckQuery,
} from "@app/graphql/generated"
import { CountryCode } from "libphonenumber-js/mobile"

import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"

gql`
  query regionCheck {
    regionCheck {
      countryCode
      custodialCreationAllowed
      restricted
    }
  }
`

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
 * The server separates "closed to new accounts" from "sanctioned", so the two fields are
 * read as given rather than derived from one another. A verdict with no country is one the
 * server could not resolve, which restricts nothing.
 */
const toVerdict = (
  regionCheck: RegionCheckQuery["regionCheck"] | undefined,
): RegionCheckVerdict | undefined => {
  if (!regionCheck) return undefined

  return {
    /** Uppercased once here, so both access modes answer the same casing. */
    countryCode: regionCheck.countryCode?.toUpperCase(),
    custodialCreationAllowed: regionCheck.custodialCreationAllowed,
    restricted: regionCheck.restricted,
  }
}

/**
 * Reading the region is the act of locating the user, so a caller with no reason to ask
 * passes false and nothing is resolved. Anon is the standing case: it speaks for an account
 * that exists and asked not to be located, so the query is never issued there.
 */
export const useRegionCheck = (enabled: boolean): RegionCheck => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const isQueryEnabled = enabled && !isAnonMode

  const { data, loading } = useRegionCheckQuery({
    skip: !isQueryEnabled,
    /** The verdict follows the connection the request went out on, so a cached answer
     *  could speak for a network the user has since left. */
    fetchPolicy: "no-cache",
  })

  /** Read only while the query is live: a skip keeps Apollo's last data around, and
   *  returning it would leak a verdict from before the caller stopped asking. */
  const servedVerdict = isQueryEnabled ? toVerdict(data?.regionCheck) : undefined
  const verdict = servedVerdict ?? UNRESOLVED_VERDICT

  /** An unreachable server is not a verdict, so nothing is held against the user and the
   *  wait ends: `regionCheck` shares an API with every other custodial feature, so there is
   *  no service left to protect. A caller that asks nothing never waits at all. */
  const isSettled = !isQueryEnabled || !loading

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
  const client = useApolloClient()

  return useCallback(async () => {
    /** An unreachable server leaves the region unread, which account creation refuses on
     *  rather than guesses at: it is the one caller that must not proceed without one. */
    const verdict = await client
      .query<RegionCheckQuery>({
        query: RegionCheckDocument,
        fetchPolicy: "no-cache",
      })
      .then(({ data }) => toVerdict(data?.regionCheck))
      .catch(() => undefined)

    if (!verdict?.countryCode) return UNRESOLVED_VERDICT

    /** Shared with every other consumer of the country, so one read serves them all. */
    updateCountryCode(client, verdict.countryCode as CountryCode)

    return verdict
  }, [client])
}
