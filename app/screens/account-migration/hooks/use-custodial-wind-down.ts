import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { AccountType } from "@app/types/wallet"

import type { WindDown } from "@app/types/wind-down"

import { useWindDownStatus } from "./use-wind-down-status"

/**
 * The wind-down as it applies to the ACTIVE account: null when the account is not
 * custodial or when the server omits the wind-down (an unaffected account), so every
 * consumer inherits the "missing wind-down means no wind-down UI" rule from one place.
 */
export const useCustodialWindDown = (): WindDown | null => {
  const { accountType } = useActiveWallet()
  const windDown = useWindDownStatus()

  if (accountType !== AccountType.Custodial) return null
  return windDown
}
