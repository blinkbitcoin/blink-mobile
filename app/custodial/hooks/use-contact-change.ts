import { useCallback, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { ContactField, contactRemoveStepOf } from "@app/types/two-factor-enforcement"
import {
  logContactChangeNeeds2faShown,
  logContactChangeStarted,
} from "@app/utils/analytics"

type ContactChange = {
  /** The pen: the code first with an authenticator, the modal that asks for one
   *  without. */
  startChange: () => void
  isNeedsAuthenticatorVisible: boolean
  closeNeedsAuthenticator: () => void
  setAuthenticator: () => void
  /** Opens the onboarding once the modal is off the screen. */
  openRequestedOnboarding: () => void
}

/**
 * Changing a login method from the settings, at every tier: the server asks for the
 * authenticator's code, so an account with one goes to the code, and an account
 * without one is asked to add it first, through the onboarding, which then goes on to
 * the change.
 */
export const useContactChange = (
  field: ContactField,
  hasAuthenticator: boolean,
): ContactChange => {
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [isNeedsAuthenticatorVisible, setIsNeedsAuthenticatorVisible] = useState(false)
  const [isOnboardingRequested, setIsOnboardingRequested] = useState(false)

  const startChange = useCallback(() => {
    logContactChangeStarted({ field, hasAuthenticator })
    if (hasAuthenticator) {
      navigate("contactChangeCode", { step: contactRemoveStepOf(field) })
      return
    }
    logContactChangeNeeds2faShown({ field })
    setIsNeedsAuthenticatorVisible(true)
  }, [field, hasAuthenticator, navigate])

  const closeNeedsAuthenticator = useCallback(
    () => setIsNeedsAuthenticatorVisible(false),
    [],
  )

  /** The onboarding opens once the modal is off the screen: pushed while the modal
   *  still closes, it can hang the transition. */
  const setAuthenticator = useCallback(() => {
    setIsOnboardingRequested(true)
    setIsNeedsAuthenticatorVisible(false)
  }, [])

  const openRequestedOnboarding = useCallback(() => {
    if (!isOnboardingRequested) return
    setIsOnboardingRequested(false)
    navigate("totpRegistrationIntro", { contactChange: field })
  }, [isOnboardingRequested, navigate, field])

  return {
    startChange,
    isNeedsAuthenticatorVisible,
    closeNeedsAuthenticator,
    setAuthenticator,
    openRequestedOnboarding,
  }
}
