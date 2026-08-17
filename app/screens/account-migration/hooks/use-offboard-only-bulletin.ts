import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { isBlockedCountry, usePhoneCountryCode } from "@app/hooks/use-device-location"
import { AccountType } from "@app/types/wallet"

import { useCustodialWalletBalances } from "./use-custodial-wallet-balances"

type OffboardOnlyBulletin = {
  isVisible: boolean
}

/**
 * Visibility of the offboard-only home bulletin: shows while a custodial account is
 * registered (by phone country) in an offboard-only region and still holds funds. The
 * registered country is the right signal — the notice is informational, not a bypassable
 * gate, so an IP fallback would only misfire on travelers; an unparseable phone hides the
 * card (enforcement is server-side). Deadline expiry is handled by ops emptying the
 * remote offboardOnlyCountries list — the client never compares dates. Balances only hide
 * the card once the query settles with data, so an unknown balance never reads as drained.
 */
export const useOffboardOnlyBulletin = (): OffboardOnlyBulletin => {
  const { activeAccount } = useAccountRegistry()
  const isCustodial = activeAccount?.type === AccountType.Custodial

  const phoneCountry = usePhoneCountryCode()
  const { offboardOnlyCountries } = useRemoteConfig()
  const inOffboardCountry = isBlockedCountry(phoneCountry, offboardOnlyCountries)

  const balances = useCustodialWalletBalances({
    skip: !isCustodial || !inOffboardCountry,
  })
  const isDrained =
    !balances.isSkipped &&
    balances.isReady &&
    balances.btcBalanceSats === 0 &&
    balances.usdBalanceCents === 0

  return { isVisible: isCustodial && inOffboardCountry && !isDrained }
}
