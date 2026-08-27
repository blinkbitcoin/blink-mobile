import React, { useState, useCallback, useEffect, useRef } from "react"
import { Alert } from "react-native"

import useLogout from "@app/hooks/use-logout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useAppConfig } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { toastShow } from "@app/utils/toast"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  SwitchProfileOutcome,
  useSwitchToNextProfile,
} from "@app/hooks/use-switch-to-next-profile"

import { NetworkErrorCode } from "./error-code"
import { useNetworkError } from "./network-error-context"

export const NetworkErrorComponent: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { networkError, clearNetworkError, token: networkErrorToken } = useNetworkError()
  const { LL } = useI18nContext()
  const { logout } = useLogout()
  const { appConfig } = useAppConfig()
  const { switchToNextProfile } = useSwitchToNextProfile()
  const { isSelfCustodial: isSelfCustodialActive } = useActiveWallet()

  const [showedAlert, setShowedAlert] = useState(false)
  const isHandlingTokenExpiry = useRef(false)

  const handleTokenExpiry = useCallback(async () => {
    if (isHandlingTokenExpiry.current) {
      console.debug("Already handling token expiry, skipping")
      return
    }
    isHandlingTokenExpiry.current = true

    const resetSyncFlag = () => {
      isHandlingTokenExpiry.current = false
    }

    try {
      const currentToken = appConfig.token
      if (!currentToken) {
        // Stale 401 from in-flight queries while the user is on self-custodial.
        if (isSelfCustodialActive) return
        // No active token right now says nothing about what is stored: a 401
        // arriving mid-switch lands here, and erasing on it would take the
        // account the user is switching to.
        await logout({ preserveStoredCredentials: true })
        navigation.reset({
          index: 0,
          routes: [{ name: "getStarted" }],
        })
        return
      }

      if (networkErrorToken !== currentToken) {
        console.debug("Ignoring 401 for non-active token", {
          networkErrorToken,
          currentToken,
        })
        return
      }

      const outcome = await switchToNextProfile(networkErrorToken)
      if (outcome === SwitchProfileOutcome.Switched) {
        return
      }

      // Custodial session is dead but the user is on self-custodial; skip re-login modal.
      if (isSelfCustodialActive) return

      // The logout below erases every saved session, which is only correct when
      // we know there is none left. An unreadable store is ignorance, not that
      // knowledge, so keep the list and sign out of everything else.
      const isStoreUnreadable = outcome === SwitchProfileOutcome.ProfilesUnreadable

      if (!showedAlert) {
        setShowedAlert(true)
        await logout({ preserveStoredCredentials: isStoreUnreadable })
        Alert.alert(LL.common.reauth(), "", [
          {
            text: LL.common.ok(),
            onPress: () => {
              setShowedAlert(false)
              navigation.reset({
                index: 0,
                routes: [{ name: "getStarted" }],
              })
            },
          },
        ])
      }
    } catch (error) {
      console.error("Error handling token expiry:", error)
      // Same rule as above, and this branch knows even less: something threw
      // mid-teardown, so the saved list stays rather than being erased on a
      // guess. A stale entry costs one failed switch; erasing costs sessions.
      await logout({ preserveStoredCredentials: true })
      navigation.reset({
        index: 0,
        routes: [{ name: "getStarted" }],
      })
    } finally {
      resetSyncFlag()
    }
  }, [
    appConfig.token,
    isSelfCustodialActive,
    logout,
    LL,
    navigation,
    networkErrorToken,
    showedAlert,
    switchToNextProfile,
  ])

  useEffect(() => {
    if (!networkError) {
      return
    }

    if ("statusCode" in networkError) {
      if (networkError.statusCode >= 500) {
        // TODO translation
        toastShow({
          message: (translations) => translations.errors.network.server(),
          LL,
        })
        clearNetworkError()
        return
      }

      if (networkError.statusCode >= 400 && networkError.statusCode < 500) {
        let errorCode =
          "result" in networkError &&
          typeof networkError.result !== "string" &&
          networkError.result?.errors?.[0]?.code
            ? networkError.result.errors[0].code
            : undefined

        if (!errorCode) {
          switch (networkError.statusCode) {
            case 401:
              errorCode = NetworkErrorCode.InvalidAuthentication
              break
          }
        }

        switch (errorCode) {
          case NetworkErrorCode.InvalidAuthentication:
            handleTokenExpiry()
            break

          default:
            // TODO translation
            toastShow({
              message: (translations) =>
                `StatusCode: ${
                  networkError.statusCode
                }\nError code: ${errorCode}\n${translations.errors.network.request()}`,
              LL,
            })
            break
        }

        clearNetworkError()
        return
      }
    }

    if ("message" in networkError && networkError.message === "Network request failed") {
      // TODO translation
      toastShow({
        message: (translations) => translations.errors.network.connection(),
        LL,
      })
      clearNetworkError()
    }
  }, [networkError, clearNetworkError, LL, handleTokenExpiry])

  return <></>
}
