import { WindDownStatus } from "../utils/backend-mock"

import { useCustodialWindDown } from "./use-custodial-wind-down"

const RECEIVE_BLOCKED_STATUSES: readonly WindDownStatus[] = [
  WindDownStatus.ReceiveDisabled,
  WindDownStatus.GatedClosed,
]

/** Whether the wind-down blocks receiving outright: from the receive cutoff
 *  through the terminal gate, a custodial account cannot take funds in. */
export const useWindDownReceiveBlocked = (): boolean => {
  const windDown = useCustodialWindDown()

  return windDown !== null && RECEIVE_BLOCKED_STATUSES.includes(windDown.status)
}
