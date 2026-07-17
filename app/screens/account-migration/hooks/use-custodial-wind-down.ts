import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"

import type { WindDown } from "@app/types/wind-down"

import { useWindDownStatus } from "./use-wind-down-status"

/**
 * The wind-down as it applies to the ACTIVE account: null when the account is not
 * custodial or when the server omits the wind-down (an unaffected account), so every
 * consumer inherits the "missing wind-down means no wind-down UI" rule from one place.
 * Reads the account type from the registry, not the active wallet whose no-account
 * placeholder defaults to Custodial and would arm the gate on a device with no account.
 */
export const useCustodialWindDown = (): WindDown | null => {
  const { activeAccount } = useAccountRegistry()
  const windDown = useWindDownStatus()

  if (activeAccount?.type !== AccountType.Custodial) return null
  return windDown
}
