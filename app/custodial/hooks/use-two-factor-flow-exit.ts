import { useCallback, useState } from "react"
import { useNavigation } from "@react-navigation/native"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { TwoFactorFlowParams, TwoFactorTier } from "@app/types/two-factor-enforcement"

type TwoFactorFlowExit = {
  /** The tier when the screen opened. */
  promptTier: TwoFactorTier
  /** Goes back, and records a skip if the user skipped the prompt. */
  leave: () => void
}

/**
 * Lets the user leave a two-factor screen. Leaving without adding an
 * authenticator counts as skipping the prompt that opened the screen.
 */
export const useTwoFactorFlowExit = ({
  origin,
  isOpenedFromSetupScreen = false,
  hasRegistrationFailedToStart = false,
}: TwoFactorFlowParams = {}): TwoFactorFlowExit => {
  const navigation = useNavigation()
  const { unmetTier, hasAuthenticator, registerDismissal } = useTwoFactorEnforcement()

  /**
   * Save the tier and the origin from the first render. useState ignores the
   * value on later renders, so these stay the same even if the balance changes
   * while the screen is open.
   */
  const [tierWhenOpened] = useState(unmetTier)
  const [originWhenOpened] = useState(origin)

  /**
   * The setup screen records its own skip, and there is nothing to skip if
   * the user already has an authenticator or the registration never started.
   */
  const isSkip =
    !isOpenedFromSetupScreen && !hasAuthenticator && !hasRegistrationFailedToStart

  const leave = useCallback(() => {
    if (isSkip) registerDismissal(tierWhenOpened, originWhenOpened)
    navigation.goBack()
  }, [isSkip, registerDismissal, tierWhenOpened, originWhenOpened, navigation])

  return { promptTier: tierWhenOpened, leave }
}
