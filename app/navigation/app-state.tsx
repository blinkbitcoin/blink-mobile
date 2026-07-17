import React, { useCallback, useEffect } from "react"
import { AppState, AppStateStatus } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useApolloClient } from "@apollo/client"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { HomeAuthedDocument } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logEnterBackground, logEnterForeground } from "@app/utils/analytics"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const MILLISECONDS_PER_SECOND = 1000

export const AppStateWrapper: React.FC = () => {
  const isAuthed = useIsAuthed()
  const appState = React.useRef(AppState.currentState)
  const client = useApolloClient()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { isAppLocked, setAppLocked } = useAuthenticationContext()
  const { appLockGracePeriodSeconds } = useRemoteConfig()

  /** When the app left the foreground, or null while it has not. A ref rather than state
   *  because nothing renders from it, and losing it to a killed process is harmless: that
   *  path already locks through the cold start. */
  const backgroundedAtRef = React.useRef<number | null>(null)

  /** The lock the user configured only ever guarded the cold start, leaving a backgrounded
   *  session open indefinitely. Re-raise it on return, past a grace period so the common
   *  hop to another app and straight back does not demand the PIN again. */
  const relockIfGracePeriodExpired = useCallback(async () => {
    const backgroundedAt = backgroundedAtRef.current
    backgroundedAtRef.current = null
    if (backgroundedAt === null) return

    /** A cold start left at the unlock screen is already locked; raising it again would
     *  stack a second unlock screen over the first, and demand the PIN twice. */
    if (isAppLocked) return

    const secondsInBackground = (Date.now() - backgroundedAt) / MILLISECONDS_PER_SECOND
    if (secondsInBackground < appLockGracePeriodSeconds) return

    const isLockEnabled =
      (await KeyStoreWrapper.getIsPinEnabled()) ||
      (await KeyStoreWrapper.getIsBiometricsEnabled())
    if (!isLockEnabled) return

    /** Both halves are needed: the flag defers incoming deep links until the unlock, and
     *  the navigation is what actually puts the lock in front of the user. */
    setAppLocked()
    navigation.navigate("authenticationCheck", { isResume: true })
  }, [appLockGracePeriodSeconds, isAppLocked, navigation, setAppLocked])

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/background/) && nextAppState === "active") {
        isAuthed && client.refetchQueries({ include: [HomeAuthedDocument] })

        console.info("App has come to the foreground!")
        logEnterForeground()

        await relockIfGracePeriodExpired()
      }

      if (appState.current.match(/active/) && nextAppState === "background") {
        backgroundedAtRef.current = Date.now()
        logEnterBackground()
      }

      appState.current = nextAppState
    },
    [client, isAuthed, relockIfGracePeriodExpired],
  )

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => subscription.remove()
  }, [handleAppStateChange])

  return <></>
}
