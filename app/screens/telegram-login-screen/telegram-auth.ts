import { useCallback, useEffect, useRef, useState } from "react"
import { Linking } from "react-native"
import axios from "axios"

import analytics from "@react-native-firebase/analytics"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { BLINK_DEEP_LINK_PREFIX, TELEGRAM_CALLBACK_PATH } from "@app/config"
import { formatPublicKey } from "@app/utils/format-public-key"
import { useAppConfig, useSaveSessionProfile } from "@app/hooks"
import { gql } from "@apollo/client"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useUserLoginUpgradeTelegramMutation } from "@app/graphql/generated"

export const ErrorType = {
  FetchParamsError: "FetchParamsError",
  FetchLoginError: "FetchLoginError",
  TimeoutError: "TimeoutError",
  OpenAppError: "OpenAppError",
} as const

type ErrorType = (typeof ErrorType)[keyof typeof ErrorType]
type TelegramAuthData = {
  botId: string
  scope: string
  publicKey: string
  nonce: string
}

gql`
  mutation userLoginUpgradeTelegram($input: UserLoginUpgradeTelegramInput!) {
    userLoginUpgradeTelegram(input: $input) {
      errors {
        message
        code
      }
      success
    }
  }
`

export const useTelegramLogin = (phone: string, onboarding: boolean = false) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { saveProfile } = useSaveSessionProfile()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorType | string | null>(null)
  const [authData, setAuthData] = useState<TelegramAuthData | null>(null)
  const [isPollingForAuth, setIsPollingForAuth] = useState(false)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollingAttemptsRef = useRef(0)
  const hasLoggedInRef = useRef(false)

  const MAX_POLLING_ATTEMPTS = 3
  const POLLING_INTERVAL_MS = 5000
  const TELEGRAM_CALLBACK = encodeURIComponent(
    `${BLINK_DEEP_LINK_PREFIX}/${TELEGRAM_CALLBACK_PATH}`,
  )

  const {
    appConfig: {
      galoyInstance: { authUrl },
    },
  } = useAppConfig()

  const { currentLevel } = useLevel()
  const isUpgradeFlow = onboarding || currentLevel === AccountLevel.Zero

  const [userLoginUpgradeTelegramMutation] = useUserLoginUpgradeTelegramMutation({
    fetchPolicy: "no-cache",
  })

  const clearPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      pollingAttemptsRef.current = 0
      setIsPollingForAuth(false)
    }
  }

  const getTelegramPassportRequestParams = useCallback(async () => {
    try {
      const url = `${authUrl}/auth/telegram-passport/request-params`
      const { data } = await axios.post(url, { phone })

      return {
        botId: data.bot_id,
        scope: encodeURIComponent(JSON.stringify(data.scope)),
        publicKey: encodeURIComponent(formatPublicKey(data.public_key)),
        nonce: data.nonce,
      }
    } catch (err) {
      throw new Error(ErrorType.FetchParamsError)
    }
  }, [authUrl, phone])

  const loginWithTelegramPassport = useCallback(
    async (nonce: string) => {
      try {
        const url = `${authUrl}/auth/telegram-passport/login`
        const { data } = await axios.post(url, { phone, nonce })
        return data
      } catch (err) {
        throw new Error(ErrorType.FetchLoginError)
      }
    },
    [authUrl, phone],
  )

  const setHasLoggedInTrue = () => {
    hasLoggedInRef.current = true
  }

  const navigateAfterAuth = useCallback(
    (authToken?: string) => {
      if (authToken) {
        saveProfile(authToken)
      }

      if (onboarding) {
        navigation.replace("onboarding", {
          screen: "welcomeLevel1",
          params: { onboarding },
        })
        return
      }
      navigation.replace("Primary")
    },
    [navigation, onboarding, saveProfile],
  )

  const upgradeLoginWithTelegram = useCallback(
    async (nonce: string) => {
      const { data } = await userLoginUpgradeTelegramMutation({
        variables: { input: { phone, nonce } },
      })
      const success = data?.userLoginUpgradeTelegram?.success
      if (success) return success

      const message =
        data?.userLoginUpgradeTelegram?.errors?.[0]?.message || ErrorType.FetchLoginError
      throw new Error(message)
    },
    [userLoginUpgradeTelegramMutation, phone],
  )

  const checkIfAuthorized = useCallback(
    async (nonce: string) => {
      if (hasLoggedInRef.current) return

      try {
        if (isUpgradeFlow) {
          const success = await upgradeLoginWithTelegram(nonce)
          if (!success) return

          setHasLoggedInTrue()
          clearPolling()
          navigateAfterAuth()
          return
        }

        const result = await loginWithTelegramPassport(nonce)
        if (!result?.authToken || hasLoggedInRef.current) return

        setHasLoggedInTrue()
        clearPolling()
        analytics().logLogin({ method: "telegram" })

        if (result.totpRequired) {
          navigation.navigate("totpLoginValidate", { authToken: result.authToken })
          return
        }

        navigateAfterAuth(result.authToken)
      } catch (e) {
        const message = (e as Error).message
        if (message.includes("Authorization data from Telegram is still pending")) return

        clearPolling()
        setError(message)
      }
    },
    [
      navigateAfterAuth,
      loginWithTelegramPassport,
      isUpgradeFlow,
      upgradeLoginWithTelegram,
      navigation,
    ],
  )

  useFocusEffect(
    useCallback(() => {
      if (!authData?.nonce) return

      const handleDeepLink = ({ url }: { url: string }) => {
        const cleanUrl = url.replace(`${BLINK_DEEP_LINK_PREFIX}/`, "")
        const [path, query] = cleanUrl.split("&")
        if (!path.includes(TELEGRAM_CALLBACK_PATH)) return

        const params = new URLSearchParams(query)
        if (params.get("tg_passport") === "success") {
          clearPolling()
          setIsPollingForAuth(true)
          pollingIntervalRef.current = setInterval(() => {
            pollingAttemptsRef.current += 1
            if (pollingAttemptsRef.current > MAX_POLLING_ATTEMPTS) {
              clearPolling()
              setError(ErrorType.TimeoutError)
              return
            }

            checkIfAuthorized(authData.nonce)
          }, POLLING_INTERVAL_MS)
        }
      }

      const sub = Linking.addEventListener("url", handleDeepLink)

      return () => {
        sub.remove()
      }
    }, [authData, checkIfAuthorized]),
  )

  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [])

  const handleTelegramLogin = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)

      const data = await getTelegramPassportRequestParams()
      setAuthData(data)

      const deepLink = `tg://passport?bot_id=${data.botId}&scope=${data.scope}&public_key=${data.publicKey}&nonce=${data.nonce}&callback_url=${TELEGRAM_CALLBACK}`
      const fallbackLink = `https://telegram.me/telegrampassport?bot_id=${data.botId}&scope=${data.scope}&public_key=${data.publicKey}&nonce=${data.nonce}&callback_url=${TELEGRAM_CALLBACK}`

      clearPolling()

      const canOpen = await Linking.canOpenURL(deepLink)
      await Linking.openURL(canOpen ? deepLink : fallbackLink).catch(() => {
        setError(ErrorType.OpenAppError)
      })
    } catch (err) {
      setError((err as Error).message || "Unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }, [TELEGRAM_CALLBACK, getTelegramPassportRequestParams])

  return {
    loading,
    error,
    isPollingForAuth,
    handleTelegramLogin,
  }
}
