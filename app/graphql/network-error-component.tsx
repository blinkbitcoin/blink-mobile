import React, { useState, useCallback, useEffect, useRef } from "react"
import { Alert } from "react-native"

import useLogout from "@app/hooks/use-logout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useAppConfig } from "@app/hooks"
import { toastShow } from "@app/utils/toast"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useSwitchToNextProfile } from "@app/hooks/use-switch-to-next-profile"

import { NetworkErrorCode } from "./error-code"
import { useNetworkError } from "./network-error-context"

export const NetworkErrorComponent: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { networkError, clearNetworkError, token: networkErrorToken } = useNetworkError()
  const { LL } = useI18nContext()
  const { logout } = useLogout()
  const { appConfig } = useAppConfig()
  const { switchToNextProfile } = useSwitchToNextProfile()

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
        await logout()
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

      const nextProfile = await switchToNextProfile(networkErrorToken)
      if (nextProfile) {
        return
      }

      if (!showedAlert) {
        setShowedAlert(true)
        await logout()
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
      await logout()
      navigation.reset({
        index: 0,
        routes: [{ name: "getStarted" }],
      })
    } finally {
      resetSyncFlag()
    }
  }, [
    appConfig.token,
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
