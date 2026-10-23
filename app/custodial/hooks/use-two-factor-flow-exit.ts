import { useCallback, useState } from "react"
import { useNavigation } from "@react-navigation/native"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { TwoFactorFlowParams, TwoFactorTier } from "@app/types/two-factor-enforcement"

type TwoFactorFlowExit = {
  /** The tier the screen was opened for: what it reports, and what leaving it unfinished
   *  is charged to, even if the balance moves while it is open. */
  promptTier: TwoFactorTier
  /** Backs out of the screen, as the dismissal of the prompt that opened it. */
  leave: () => void
}

/**
 * The way out of a screen a two-factor prompt opens. Leaving it unfinished is that
 * prompt's dismissal, charged to the tier and reported under the prompt it was opened
 * from; the provider ignores it below the tiers that count one. Opened from the setup,
 * it only goes back there: the setup is still up, and leaving it is what counts.
 */
export const useTwoFactorFlowExit = ({
  origin,
  isOpenedFromSetupScreen = false,
  hasRegistrationFailedToStart = false,
}: TwoFactorFlowParams = {}): TwoFactorFlowExit => {
  const navigation = useNavigation()
  const { unmetTier, hasAuthenticator, registerDismissal } = useTwoFactorEnforcement()
  const [promptTier] = useState(unmetTier)
  /** The prompt that opened the screen, whose dismissal leaving it is. */
  const [openedFrom] = useState(origin)

  /** An authenticator added meanwhile, from a code accepted after its screen was left,
   *  leaves the prompt nothing to be dismissed for, and a registration that could not
   *  start is no answer to it. */
  const isDismissal =
    !isOpenedFromSetupScreen && !hasAuthenticator && !hasRegistrationFailedToStart

  const leave = useCallback(() => {
    if (isDismissal) registerDismissal(promptTier, openedFrom)
    navigation.goBack()
  }, [isDismissal, registerDismissal, promptTier, openedFrom, navigation])

  return { promptTier, leave }
}
