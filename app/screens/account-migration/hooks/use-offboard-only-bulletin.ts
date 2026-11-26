import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { isBlockedCountry, usePhoneCountryCode } from "@app/hooks/use-device-location"
import { AccountType } from "@app/types/wallet"
import { WindDownStatus } from "@app/types/wind-down"

import { useCustodialWalletBalances } from "./use-custodial-wallet-balances"
import { useCustodialWindDown } from "./use-custodial-wind-down"

type OffboardOnlyBulletin = {
  isVisible: boolean
  /** The phase the card's copy speaks to; only read while visible. */
  status: WindDownStatus
  deadlineTimestamp: number
  receiveDisabledTimestamp: number
  timezone: string | undefined
}

/**
 * Visibility of the offboard-only home bulletin: shows while a custodial account is
 * registered (by phone country) in an offboard-only region, the server reports a
 * wind-down for it, and it still holds funds. The registered country is the right
 * signal — the notice is informational, not a bypassable gate, so an IP fallback would
 * only misfire on travelers; an unparseable phone hides the card (enforcement is
 * server-side). The card's dates and phase come from the server's wind-down, so a region
 * without one shows nothing rather than an undated notice; deadline expiry is still
 * handled by ops emptying the remote offboardOnlyCountries list — the client never
 * compares dates to pick a phase. Balances only hide the card once the query settles with
 * data, so an unknown balance never reads as drained.
 */
export const useOffboardOnlyBulletin = (): OffboardOnlyBulletin => {
  const { activeAccount } = useAccountRegistry()
  const isCustodial = activeAccount?.type === AccountType.Custodial
  const windDown = useCustodialWindDown()
  const hasWindDown = windDown !== null

  const phoneCountry = usePhoneCountryCode()
  const { offboardOnlyCountries } = useRemoteConfig()
  const inOffboardCountry = isBlockedCountry(phoneCountry, offboardOnlyCountries)

  const balances = useCustodialWalletBalances({
    skip: !isCustodial || !inOffboardCountry || !hasWindDown,
  })
  const isDrained =
    !balances.isSkipped &&
    balances.isReady &&
    balances.btcBalanceSats === 0 &&
    balances.usdBalanceCents === 0

  /** The wind-down fields are display data for the card, only read while visible. */
  return {
    isVisible: isCustodial && inOffboardCountry && hasWindDown && !isDrained,
    status: windDown?.status ?? WindDownStatus.PreCutoff,
    deadlineTimestamp: windDown?.finalDeadline ?? 0,
    receiveDisabledTimestamp: windDown?.receiveDisabledAt ?? 0,
    timezone: windDown?.timezone,
  }
}
