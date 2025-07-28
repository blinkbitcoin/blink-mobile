import { useState, useCallback } from "react"
import * as Keychain from "react-native-keychain"
import { generateSecureRandom } from "react-native-securerandom"
import { v4 as uuidv4 } from "uuid"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import analytics from "@react-native-firebase/analytics"
import crashlytics from "@react-native-firebase/crashlytics"

import { useAppConfig, useSaveSessionProfile } from "@app/hooks"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  logAttemptCreateDeviceAccount,
  logCreateDeviceAccountFailure,
  logCreatedDeviceAccount,
} from "@app/utils/analytics"

const DEVICE_ACCOUNT_CREDENTIALS_KEY = "device-account"

const generateSecureRandomUUID = async (): Promise<string> => {
  const randomBytes = await generateSecureRandom(16)
  return uuidv4({ random: randomBytes })
}

export const useCreateDeviceAccount = () => {
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  const {
    appConfig: {
      galoyInstance: { authUrl },
    },
  } = useAppConfig()

  const { saveProfile } = useSaveSessionProfile()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Primary">>()

  const getOrCreateCredentials = async (): Promise<{
    username: string
    password: string
  }> => {
    const credentials = await Keychain.getInternetCredentials(
      DEVICE_ACCOUNT_CREDENTIALS_KEY,
    )
    const username = credentials ? credentials.username : await generateSecureRandomUUID()
    const password = credentials ? credentials.password : await generateSecureRandomUUID()

    if (!credentials) {
      const keychainRes = await Keychain.setInternetCredentials(
        DEVICE_ACCOUNT_CREDENTIALS_KEY,
        username,
        password,
      )
      if (!keychainRes) throw new Error("Failed to save credentials")
    }

    return { username, password }
  }

  const createDeviceAccountAndLogin = useCallback(
    async (appCheckToken: string, onClose?: () => void) => {
      try {
        setLoading(true)
        setHasError(false)

        const { username, password } = await getOrCreateCredentials()
        const auth = Buffer.from(`${username}:${password}`, "utf8").toString("base64")

        logAttemptCreateDeviceAccount()

        const res = await fetch(`${authUrl}/auth/create/device-account`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            Appcheck: appCheckToken || "undefined",
          },
        })

        const data: { result?: string } = await res.json()
        const authToken = data.result

        if (!authToken) {
          throw new Error("Missing session token")
        }

        logCreatedDeviceAccount()
        analytics().logLogin({ method: "device" })
        saveProfile(authToken)
        navigation.replace("Primary")
        onClose?.()
      } catch (err) {
        setHasError(true)
        logCreateDeviceAccountFailure()

        if (err instanceof Error) {
          crashlytics().recordError(err)
        }

        console.error("Device account creation error:", err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [authUrl, navigation, saveProfile],
  )

  return {
    createDeviceAccountAndLogin,
    loading,
    hasError,
    resetError: () => setHasError(false),
  }
}
