import { useCallback, useState } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { CreationBlockReason } from "@app/types/account"
import { decideCustodialEligibility } from "@app/utils/custodial-eligibility"

import { AccountOption } from "./use-account-type-options"
import { useAccountRegistry } from "./use-account-registry"
import { isBlockedCountry } from "./use-device-location"
import { useRegionCheckLazy } from "./use-region-check"

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
  const { selfCustodialCreationBlockedCountries, custodialFirstSignupBlockedCountries } =
    useRemoteConfig()
  const [isResolving, setIsResolving] = useState(false)
  /**
   * Asked for on submit, never subscribed to: browsing the creation screens locates nobody.
   * The custodial verdict is the server's to give, and a self-custodial wallet has no Blink
   * account behind it, so its own list answers for it.
   */
  const resolveRegionCheck = useRegionCheckLazy()

  const checkBlockReason = useCallback(
    async (option: AccountOption): Promise<CreationBlockReason | null> => {
      setIsResolving(true)
      try {
        const { countryCode, custodialCreationAllowed } = await resolveRegionCheck()
        if (countryCode === undefined) return CreationBlockReason.UnknownRegion

        /** Exhaustive on purpose: a third option fails to compile until it declares who
         *  answers for it, rather than silently inheriting another type's rule. */
        const isOptionAllowedByRegion: Record<AccountOption, boolean> = {
          [AccountOption.Custodial]: custodialCreationAllowed,
          [AccountOption.SelfCustodial]: !isBlockedCountry(
            countryCode,
            selfCustodialCreationBlockedCountries,
          ),
        }
        if (!isOptionAllowedByRegion[option]) return CreationBlockReason.Region

        /** Only Blink accounts answer to this rule; a self-custodial wallet is the user's own. */
        if (option !== AccountOption.Custodial) return null

        const isSignupAllowed = decideCustodialEligibility({
          country: countryCode,
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
      resolveRegionCheck,
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
