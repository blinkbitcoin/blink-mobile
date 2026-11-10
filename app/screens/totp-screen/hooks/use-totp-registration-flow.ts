import { useCallback } from "react"
import { CommonActions, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { totpRegistrationStart } from "@app/navigation/two-factor-remedy-routes"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorFlowParams, TwoFactorPrompt } from "@app/types/two-factor-enforcement"

type SetupKeyBackupParams = RootStackParamList["totpRegistrationBackup"]

type TotpRegistrationFlow = {
  /** Takes the screens up to this one off the stack and puts the key's backup in their
   *  place. */
  showBackup: (params: SetupKeyBackupParams) => void
  /** Closes every screen of the registration, back to wherever it was started from. */
  leave: () => void
  /** The two-factor prompt the registration was started from, as its onboarding was
   *  told, none when it was started from the settings. */
  registrationPrompt: () => TwoFactorPrompt | undefined
  /** Tells the onboarding whether the registration could start: while it could not,
   *  leaving it is no dismissal of the prompt that opened it, and once a try does, it
   *  is again. */
  markStart: (hasFailed: boolean) => void
}

const ONBOARDING_ROUTE = "totpRegistrationIntro" satisfies keyof RootStackParamList

type StackRoute = { name: string; params?: object }

/** The prompt the onboarding was opened with, when the registration began there. */
const onboardingPromptOf = (
  route: StackRoute | undefined,
): TwoFactorPrompt | undefined => {
  if (route?.name !== ONBOARDING_ROUTE) return undefined
  const params: TwoFactorFlowParams | undefined = route.params
  return params?.origin?.prompt
}

/**
 * The authenticator registration's way through, wherever it was started from: a prompt,
 * the setup, the gate or the settings. Once the code is accepted, the onboarding and the
 * setup key have nothing left to offer and the key they showed is spent, so the backup
 * stands in for them and backing out of it lands where the registration began. The flow
 * never names that place: it is whatever lies below the registration's screens.
 */
export const useTotpRegistrationFlow = (): TotpRegistrationFlow => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { key: screenKey } = useRoute()

  const showBackup = useCallback(
    (params: SetupKeyBackupParams) => {
      /** The answer can land after the user left the registration, or under a screen
       *  pushed meanwhile, such as the app lock on a return from the background. The
       *  backup replaces this screen and the ones before it, never what is above it, and
       *  not at all once this screen is gone: it never shows over whatever the user went
       *  to, which may be another account or the lock. The code screen holds the user's
       *  ways back while the code is checked, so only a check that ran too long, or a
       *  reset the app dispatched, gets there; the key is in the authenticator app by
       *  then, which the code came from. */
      const isScreenOpen = navigation
        .getState()
        .routes.some((route) => route.key === screenKey)
      if (!isScreenOpen) return
      /** From the state as it stands: the routes around keep their keys, and with them
       *  their screens, and the router keys the backup. */
      navigation.dispatch((state) => {
        const screenIndex = state.routes.findIndex((route) => route.key === screenKey)
        const start = totpRegistrationStart(state.routes, screenIndex)
        const routes = [
          ...state.routes.slice(0, start),
          { name: "totpRegistrationBackup", params },
          ...state.routes.slice(screenIndex + 1),
        ]
        return CommonActions.reset({ ...state, routes, index: routes.length - 1 })
      })
    },
    [navigation, screenKey],
  )

  const leave = useCallback(() => {
    const { routes } = navigation.getState()
    navigation.pop(routes.length - totpRegistrationStart(routes))
  }, [navigation])

  /** The registration's first screen, up to this one. */
  const registrationStartRoute = useCallback(() => {
    const { routes } = navigation.getState()
    const screenIndex = routes.findIndex((route) => route.key === screenKey)
    return routes[totpRegistrationStart(routes, screenIndex)]
  }, [navigation, screenKey])

  const registrationPrompt = useCallback(
    () => onboardingPromptOf(registrationStartRoute()),
    [registrationStartRoute],
  )

  const markStart = useCallback(
    (hasFailed: boolean) => {
      const startRoute = registrationStartRoute()
      if (startRoute?.name !== ONBOARDING_ROUTE) return
      const params: TwoFactorFlowParams = { hasRegistrationFailedToStart: hasFailed }
      navigation.dispatch({ ...CommonActions.setParams(params), source: startRoute.key })
    },
    [navigation, registrationStartRoute],
  )

  return { showBackup, leave, registrationPrompt, markStart }
}
