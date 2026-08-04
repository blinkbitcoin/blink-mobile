import { useCallback } from "react"
import { BackHandler } from "react-native"

import { RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native"
import {
  NativeStackNavigationOptions,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack"

import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

type UseUnlockScreenParams = {
  isResume: boolean
}

/**
 * Blocking a resume lock from being dismissed takes one guard per platform, and neither is
 * redundant: iOS `gestureEnabled` blocks the edge swipe, Android the back press
 * `useUnlockScreen` intercepts. Only a resume turns them off; a cold start needs the gesture
 * as the only way out of the header-less PIN flow Settings opens.
 */
export const unlockScreenOptions = ({
  route,
}: {
  route: RouteProp<RootStackParamList, "authenticationCheck" | "authentication" | "pin">
}): NativeStackNavigationOptions => ({
  headerShown: false,
  gestureEnabled: !route.params?.isResume,
})

/** Shared contract for the unlock screens: refuse dismissal while a resume lock is up, then
 *  step back on unlock, where a cold start instead routes forward. */
export const useUnlockScreen = ({ isResume }: UseUnlockScreenParams) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { setAppUnlocked } = useAuthenticationContext()

  useFocusEffect(
    useCallback(() => {
      if (!isResume) return

      /** BackHandler, not a beforeRemove listener, so the unlock's own goBack still runs:
       *  that guard would see the stale locked state a tick later and cancel it. */
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => true)
      return () => subscription.remove()
    }, [isResume]),
  )

  const completeUnlock = useCallback(
    (navigateOnColdStart: () => void) => {
      setAppUnlocked()

      if (isResume) {
        navigation.goBack()
        return
      }

      navigateOnColdStart()
    },
    [isResume, navigation, setAppUnlocked],
  )

  return { completeUnlock }
}
