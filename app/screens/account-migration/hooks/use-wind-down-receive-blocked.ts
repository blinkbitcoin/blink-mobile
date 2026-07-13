import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { AccountType } from "@app/types/wallet"

import { WindDownStatus } from "../utils/backend-mock"

import { useWindDownStatus } from "./use-wind-down-status"

const RECEIVE_BLOCKED_STATUSES: readonly WindDownStatus[] = [
  WindDownStatus.ReceiveDisabled,
  WindDownStatus.GatedClosed,
]

/** Whether the wind-down blocks receiving outright: from the receive cutoff
 *  through the terminal gate, a custodial account cannot take funds in. */
export const useWindDownReceiveBlocked = (): boolean => {
  const { accountType } = useActiveWallet()
  const windDown = useWindDownStatus()

  return (
    accountType === AccountType.Custodial &&
    windDown !== null &&
    RECEIVE_BLOCKED_STATUSES.includes(windDown.status)
  )
}
