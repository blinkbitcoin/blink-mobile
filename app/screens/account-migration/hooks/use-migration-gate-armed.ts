import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { AccountType } from "@app/types/wallet"

import { WindDownStatus } from "../utils/backend-mock"

import { useWindDownStatus } from "./use-wind-down-status"

/** The post-deadline gate arms only for custodial accounts whose server
 *  wind-down status reports the closure; the client never derives it from dates. */
export const useMigrationGateArmed = (): boolean => {
  const { accountType } = useActiveWallet()
  const windDown = useWindDownStatus()

  return (
    accountType === AccountType.Custodial &&
    windDown?.status === WindDownStatus.GatedClosed
  )
}
