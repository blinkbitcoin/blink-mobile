import { useCallback, useRef, useState } from "react"

import { useApolloClient } from "@apollo/client"
import { CountryCode } from "libphonenumber-js/mobile"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { useCountryCodeQuery } from "@app/graphql/generated"
import { CreationBlockReason } from "@app/types/account"
import { decideCustodialEligibility } from "@app/utils/custodial-eligibility"
import { resolveIpCountryCodeCached } from "@app/utils/ip-country-lookup"

import { AccountOption } from "./use-account-type-options"
import { useAccountRegistry } from "./use-account-registry"
import { isBlockedCountry, usePhoneCountryCode } from "./use-device-location"

type CreationBlock = {
  checkBlockReason: (option: AccountOption) => Promise<CreationBlockReason | null>
  /** True while an answer cannot be trusted yet, which is what holds the submit button. */
  isChecking: boolean
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
  /** A phone already in hand is the registered country, so no connection need be read. */
  const phoneCountryCode = usePhoneCountryCode({ isCustodialFlow: true })
  const client = useApolloClient()
  const { data } = useCountryCodeQuery()
  const cachedCountryCode = data?.countryCode as CountryCode | undefined
  /** Counted rather than flagged: a screen may submit every option at once. */
  const checksInFlight = useRef(0)
  const [isResolving, setIsResolving] = useState(false)

  const resolveCountry = useCallback(async (): Promise<string | undefined> => {
    if (phoneCountryCode) return phoneCountryCode.toUpperCase()

    const resolved = await resolveIpCountryCodeCached()
    if (resolved) {
      updateCountryCode(client, resolved)
      return resolved.toUpperCase()
    }
    /** A country read earlier this install beats none at all when the lookup is down. */
    return cachedCountryCode?.toUpperCase()
  }, [phoneCountryCode, cachedCountryCode, client])

  const checkBlockReason = useCallback(
    async (option: AccountOption): Promise<CreationBlockReason | null> => {
      checksInFlight.current += 1
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
        checksInFlight.current -= 1
        if (checksInFlight.current === 0) setIsResolving(false)
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

  /** Account count decides the first-signup rule, so an unsettled registry cannot answer. */
  return { checkBlockReason, isChecking: isResolving || isRegistryHydrating }
}
