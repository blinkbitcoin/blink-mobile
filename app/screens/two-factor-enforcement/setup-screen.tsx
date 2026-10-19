import React, { useCallback, useEffect, useLayoutEffect, useState } from "react"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { headerCloseControlOptions } from "@app/components/header-close-control"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"

import { TwoFactorSetupContent } from "./setup-content"

const RETURN_ROUTE = RegistrationReturnRoute.TwoFactorSetup

/**
 * The setup as a route: reached from the home card, the Settings banner and the
 * session modal, and closable from its header. Leaving it without an authenticator
 * counts as the session's dismissal for the tiers that prompt. The authenticator flow
 * returns into it on success, and it then steps aside to wherever it was opened from.
 */
export const TwoFactorSetupScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "twoFactorSetup">>()
  const isFocused = useIsFocused()
  const { unmetTier, hasAuthenticator, registerDismissal } = useTwoFactorEnforcement()
  /** The tier this screen was opened for: what it reports, and what leaving it unfinished
   *  is charged to, even if the balance moves while it is open. */
  const [promptTier] = useState(unmetTier)

  /** Leaving without an authenticator is a dismissal for the tiers that prompt at session
   *  start; the provider ignores it below them. The hardware back leaves the same way,
   *  and the swipe is off for this route, so no exit skips the count. */
  const handleClose = useCallback(() => {
    registerDismissal(promptTier)
    navigation.goBack()
  }, [registerDismissal, promptTier, navigation])

  useHardwareBackGuard(handleClose)

  useLayoutEffect(() => {
    navigation.setOptions(headerCloseControlOptions({ onPress: handleClose }))
  }, [navigation, handleClose])

  /** The authenticator flow returns into this screen. Once the account holds an
   *  authenticator there is nothing left to offer, so it steps aside rather than asking
   *  for one the account just added. Only while focused: a screen lower in the stack
   *  going back would pop whichever screen is on top instead of itself. */
  const isSetupComplete = isFocused && hasAuthenticator
  useEffect(() => {
    if (isSetupComplete) navigation.goBack()
  }, [isSetupComplete, navigation])

  return <TwoFactorSetupContent promptTier={promptTier} returnTo={RETURN_ROUTE} />
}
