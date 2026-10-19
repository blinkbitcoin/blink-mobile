import React, { useCallback, useEffect, useLayoutEffect, useState } from "react"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { headerCloseControlOptions } from "@app/components/header-close-control"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useEmailReverification } from "@app/hooks/use-email-reverification"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"

import { TwoFactorSetupContent } from "./setup-content"

const RETURN_ROUTE = RegistrationReturnRoute.TwoFactorSetup

/**
 * The setup as a route: reached from the home card, the Settings banner and the
 * session modal, and closable from its header. Leaving it without a factor counts as
 * the session's dismissal for the tiers that prompt. The flows it starts return into
 * it on success, and it then steps aside to wherever it was opened from.
 */
export const TwoFactorSetupScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "twoFactorSetup">>()
  const isFocused = useIsFocused()
  const { unmetTier, hasAuthenticator, registerDismissal } = useTwoFactorEnforcement()
  /** The screen holds the user for a re-verification asked for from it, for as long
   *  as the hook runs it: the hook bounds that with its own deadline, so the hold, the
   *  spinner and the buttons release together. One joined from elsewhere, started on
   *  another screen before this one opened, only shows its spinner, since the user
   *  pressed nothing here. */
  const {
    promptReverification,
    spinner: isReverifying,
    isAskedHere: isHeld,
  } = useEmailReverification({ returnTo: RETURN_ROUTE })
  /** The tier this screen was opened for: what it reports, and what leaving it unfinished
   *  is charged to, even if the balance moves while it is open. */
  const [promptTier] = useState(unmetTier)

  /** Leaving without a factor is a dismissal for the tiers that prompt at session start;
   *  the provider ignores it below them. The hardware back leaves the same way, and the
   *  swipe is off for this route, so no exit skips the count. While held, the screen
   *  stays instead: the hook navigates to the code screen when it is done, and that
   *  must land here, not on whatever lies beneath once this screen is gone. The close
   *  control is greyed out meanwhile, so the refusal shows. */
  const handleClose = useCallback(() => {
    if (isHeld) return
    registerDismissal(promptTier)
    navigation.goBack()
  }, [isHeld, registerDismissal, promptTier, navigation])

  useHardwareBackGuard(handleClose)

  useLayoutEffect(() => {
    navigation.setOptions(
      headerCloseControlOptions({ onPress: handleClose, disabled: isHeld }),
    )
  }, [navigation, handleClose, isHeld])

  /** The flows this screen hands off to return into it. Once the account holds an
   *  authenticator there is nothing left to offer, so it steps aside rather than asking
   *  for one the account just added. Only while focused: a screen lower in the stack
   *  going back would pop whichever screen is on top instead of itself. And only once
   *  the hold above has lifted: the flow it holds for returns into this screen. */
  const isSetupComplete = isFocused && hasAuthenticator && !isHeld
  useEffect(() => {
    if (isSetupComplete) navigation.goBack()
  }, [isSetupComplete, navigation])

  return (
    <TwoFactorSetupContent
      promptTier={promptTier}
      returnTo={RETURN_ROUTE}
      promptReverification={promptReverification}
      isReverifying={isReverifying}
    />
  )
}
