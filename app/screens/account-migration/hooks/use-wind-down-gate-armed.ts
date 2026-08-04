import { WindDownStatus } from "@app/types/wind-down"

import { useCustodialWindDown } from "./use-custodial-wind-down"

/** The post-deadline gate arms only for custodial accounts whose server
 *  wind-down status reports the closure; the client never derives it from dates. */
export const useWindDownGateArmed = (): boolean => {
  const windDown = useCustodialWindDown()

  return windDown?.status === WindDownStatus.GatedClosed
}
