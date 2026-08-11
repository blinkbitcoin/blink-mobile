import { useCallback, useState } from "react"

import { useApolloClient } from "@apollo/client"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { CreationBlockReason } from "@app/types/account"
import { decideCustodialEligibility } from "@app/utils/custodial-eligibility"
import { resolveIpCountryCodeCached } from "@app/utils/ip-country-lookup"

import { AccountOption } from "./use-account-type-options"
import { useAccountRegistry } from "./use-account-registry"
import { isBlockedCountry } from "./use-device-location"

type CreationBlock = {
  checkBlockReason: (option: AccountOption) => Promise<CreationBlockReason | null>
  /** A check is in flight, so the button that asked for it waits on its own answer. */
  isChecking: boolean
  /** The device's account count has settled. Only the custodial first-signup rule reads
   *  it, so a caller submitting self-custodial alone has nothing to wait for. */
  isFirstSignupRuleReady: boolean
}

/**
 * Region rules for account creation, resolved when an option is submitted rather than when
 * the screen mounts. The connection is only looked up by someone actually asking for an
 * account, so browsing the screen, or coming through to restore one, locates nobody.
 */
export const useCreationBlock = (): CreationBlock => {
  const { accounts, loading: isRegistryHydrating } = useAccountRegistry()
  const {
    custodialCreationBlockedCountries,
    selfCustodialCreationBlockedCountries,
    custodialFirstSignupBlockedCountries,
  } = useRemoteConfig()
  const client = useApolloClient()
  const [isResolving, setIsResolving] = useState(false)

  /**
   * The connection alone, matching the `regionCheck` query this will hand over to: an
   * account being created has no phone of its own, and borrowing another account's would
   * make the verdict depend on which one happens to be open. There is no local fallback
   * either, since the country-code cache answers "SV" for an unset value and would turn
   * "could not resolve" into a country nobody read.
   */
  const resolveCountry = useCallback(async (): Promise<string | undefined> => {
    const resolved = await resolveIpCountryCodeCached()
    if (!resolved) return undefined

    updateCountryCode(client, resolved)
    return resolved.toUpperCase()
  }, [client])

  const checkBlockReason = useCallback(
    async (option: AccountOption): Promise<CreationBlockReason | null> => {
      setIsResolving(true)
      try {
        const country = await resolveCountry()
        if (country === undefined) return CreationBlockReason.UnknownRegion

        const blockedCountriesByOption: Record<AccountOption, string[]> = {
          [AccountOption.Custodial]: custodialCreationBlockedCountries,
          [AccountOption.SelfCustodial]: selfCustodialCreationBlockedCountries,
        }
        if (isBlockedCountry(country, blockedCountriesByOption[option])) {
          return CreationBlockReason.Region
        }

        /** Only Blink accounts answer to this rule; a self-custodial wallet is the user's own. */
        if (option !== AccountOption.Custodial) return null

        const isSignupAllowed = decideCustodialEligibility({
          country,
          accountCount: accounts.length,
          custodialFirstSignupBlockedCountries,
        })

        return isSignupAllowed ? null : CreationBlockReason.FirstCustodialSignup
      } finally {
        setIsResolving(false)
      }
    },
    [
      accounts.length,
      resolveCountry,
      custodialCreationBlockedCountries,
      selfCustodialCreationBlockedCountries,
      custodialFirstSignupBlockedCountries,
    ],
  )

  return {
    checkBlockReason,
    isChecking: isResolving,
    /** A registry still hydrating reads as a device holding no account, which would refuse
     *  the first-signup rule to someone who already has one. */
    isFirstSignupRuleReady: !isRegistryHydrating,
  }
}
