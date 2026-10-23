import { useCallback } from "react"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { TwoFactorTier } from "@app/types/two-factor-enforcement"
import {
  logTwoFactorDisableAttempted,
  logTwoFactorDisableBlocked,
} from "@app/utils/analytics"

type TwoFactorTurnOff = {
  /** Whether the app refuses turning the authenticator off: the account reached the
   *  high-balance tier, where it is mandatory, even if the balance has since dropped.
   *  Only while the prompts apply. The server refuses a balance that high on its own,
   *  once its step-up check is on (`twoFactor.stepUpEnabled`). */
  isTurnOffBlocked: boolean
  /** Whether that is known yet: the tier reached is read from the device after a launch
   *  or an account switch, and until then a tier-three account would read as allowed. */
  isTurnOffDecided: boolean
  reportAttempt: () => void
  reportBlocked: () => void
}

/** Whether the authenticator may be turned off, and the events that say how asking for
 *  it went, under the tier the account reached. */
export const useTwoFactorTurnOff = (): TwoFactorTurnOff => {
  const { tier, isEnforced, isPreparingSessionStart } = useTwoFactorEnforcement()
  const isHighBalanceReached = tier >= TwoFactorTier.HighBalance
  const isTurnOffBlocked = isEnforced && isHighBalanceReached

  const reportAttempt = useCallback(() => logTwoFactorDisableAttempted({ tier }), [tier])
  const reportBlocked = useCallback(() => logTwoFactorDisableBlocked({ tier }), [tier])

  return {
    isTurnOffBlocked,
    isTurnOffDecided: !isPreparingSessionStart,
    reportAttempt,
    reportBlocked,
  }
}
