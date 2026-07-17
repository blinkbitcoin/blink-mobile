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

  /** Read through refs so that flipping the lock, or a remote-config refresh, never tears
   *  down and re-subscribes the AppState listener underneath a transition in flight. */
  const isAppLockedRef = React.useRef(isAppLocked)
  const gracePeriodSecondsRef = React.useRef(appLockGracePeriodSeconds)

  useEffect(() => {
    isAppLockedRef.current = isAppLocked
    gracePeriodSecondsRef.current = appLockGracePeriodSeconds
  }, [isAppLocked, appLockGracePeriodSeconds])

  /** The lock the user configured only ever guarded the cold start, leaving a backgrounded
   *  session open indefinitely. Re-raise it on return, past a grace period so the common
   *  hop to another app and straight back does not demand the PIN again. */
  const relockIfGracePeriodExpired = useCallback(async () => {
    const backgroundedAt = backgroundedAtRef.current
    backgroundedAtRef.current = null
    if (backgroundedAt === null) return

    /** A cold start left at the unlock screen is already locked; raising it again would
     *  stack a second unlock screen over the first, and demand the PIN twice. */
    if (isAppLockedRef.current) return

    /** React Native exposes no monotonic clock, so the trip is measured against the wall
     *  clock, which the user can move. Winding it forward only locks sooner; winding it
     *  back is the bypass, so a clock that went backwards is treated as a trip that cannot
     *  be trusted, and locks rather than being let through. */
    const secondsInBackground = (Date.now() - backgroundedAt) / MILLISECONDS_PER_SECOND
    const isWithinGracePeriod =
      secondsInBackground >= 0 && secondsInBackground < gracePeriodSecondsRef.current
    if (isWithinGracePeriod) return

    const isLockEnabled =
      (await KeyStoreWrapper.getIsPinEnabled()) ||
      (await KeyStoreWrapper.getIsBiometricsEnabled())
    if (!isLockEnabled) return

    /** Both halves are needed: the flag defers incoming deep links until the unlock, and
     *  the navigation is what actually puts the lock in front of the user. */
    setAppLocked()
    navigation.navigate("authenticationCheck", { isResume: true })
  }, [navigation, setAppLocked])

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      /** Recorded before the await below, so that a transition arriving while the relock is
       *  still running reads the state this one already moved to, rather than a stale one. */
      const previousAppState = appState.current
      appState.current = nextAppState

      /** iOS reaches the background through "inactive", which is where `RCTAppState` maps
       *  `willResignActive`, while Android leaves straight from "active". Both are spelled
       *  out rather than matched loosely, since /active/ also matches "inactive" and the
       *  relock would quietly depend on that substring accident. */
      const isEnteringForeground =
        previousAppState === "background" && nextAppState === "active"
      const isLeavingForeground =
        (previousAppState === "active" || previousAppState === "inactive") &&
        nextAppState === "background"

      if (isEnteringForeground) {
        isAuthed && client.refetchQueries({ include: [HomeAuthedDocument] })

        console.info("App has come to the foreground!")
        logEnterForeground()

        await relockIfGracePeriodExpired()
      }

      if (isLeavingForeground) {
        backgroundedAtRef.current = Date.now()
        logEnterBackground()
      }
    },
    [client, isAuthed, relockIfGracePeriodExpired],
  )

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => subscription.remove()
  }, [handleAppStateChange])

  return <></>
}
