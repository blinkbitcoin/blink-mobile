import React, { useCallback, useEffect, useRef } from "react"
import { AppState, AppStateStatus } from "react-native"

import { useApolloClient } from "@apollo/client"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { HomeAuthedDocument } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { logEnterBackground, logEnterForeground } from "@app/utils/analytics"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import type { RootStackParamList } from "@app/navigation/stack-param-lists"

const LOCK_GRACE_PERIOD_MS = 5000

export const AppStateWrapper: React.FC = () => {
  const isAuthed = useIsAuthed()
  const appState = useRef(AppState.currentState)
  const backgroundTimestamp = useRef<number | null>(null)
  const client = useApolloClient()
  const { setAppLocked, isAppLocked } = useAuthenticationContext()
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "authenticationCheck">>()

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/background/) && nextAppState === "active") {
        logEnterForeground()

        const elapsed = backgroundTimestamp.current
          ? Date.now() - backgroundTimestamp.current
          : Infinity
        backgroundTimestamp.current = null

        if (!isAppLocked && elapsed > LOCK_GRACE_PERIOD_MS) {
          const isPinEnabled = await KeyStoreWrapper.getIsPinEnabled()
          const isBiometricsEnabled =
            (await BiometricWrapper.isSensorAvailable()) &&
            (await KeyStoreWrapper.getIsBiometricsEnabled())

          if (isPinEnabled || isBiometricsEnabled) {
            setAppLocked()
            navigation.reset({
              index: 0,
              routes: [{ name: "authenticationCheck" }],
            })
            return
          }
        }

        isAuthed && client.refetchQueries({ include: [HomeAuthedDocument] })
      }

      if (appState.current.match(/active/) && nextAppState === "background") {
        backgroundTimestamp.current = Date.now()
        logEnterBackground()
      }

      appState.current = nextAppState
    },
    [client, isAuthed, isAppLocked, setAppLocked, navigation],
  )

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => subscription.remove()
  }, [handleAppStateChange])

  return <></>
}
