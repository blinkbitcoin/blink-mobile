import { useRemoteConfig } from "@app/config/feature-flags-context"

import { AccountOption } from "./use-account-type-options"
import useDeviceLocation, { isBlockedCountry } from "./use-device-location"

type CreationBlock = {
  isCreationBlocked: (option: AccountOption) => boolean
  loading: boolean
}

/**
 * Region block for account creation. Maps each account option to its own
 * remote-config country list and reports whether the detected location is blocked,
 * so the signup flow can redirect to the Unsupported region screen.
 */
export const useCreationBlock = (): CreationBlock => {
  /** Resolves the region even from an Anon session: the account being created has no mode
   *  of its own yet, and a custodial one never will, so neither may inherit another
   *  account's Anon. Without this the country reads undefined and creation passes
   *  unchecked. */
  const { countryCode, loading } = useDeviceLocation({ isCustodialFlow: true })
  const { custodialCreationBlockedCountries, selfCustodialCreationBlockedCountries } =
    useRemoteConfig()

  const blockedCountriesByOption: Record<AccountOption, string[]> = {
    [AccountOption.Custodial]: custodialCreationBlockedCountries,
    [AccountOption.SelfCustodial]: selfCustodialCreationBlockedCountries,
  }

  const isCreationBlocked = (option: AccountOption): boolean =>
    isBlockedCountry(countryCode, blockedCountriesByOption[option])

  return { isCreationBlocked, loading }
}
