import { useCallback } from "react"

import { gql } from "@apollo/client"
import { SCHEMA_VERSION_KEY } from "@app/config"
import { useUserLogoutMutation } from "@app/graphql/generated"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { logLogout } from "@app/utils/analytics"
import AsyncStorage from "@react-native-async-storage/async-storage"
import crashlytics from "@react-native-firebase/crashlytics"
import messaging from "@react-native-firebase/messaging"

import KeyStoreWrapper from "../utils/storage/secureStorage"

type LogoutOptions = {
  stateToDefault?: boolean
  token?: string
  isValidToken?: boolean
}

gql`
  mutation userLogout($input: UserLogoutInput!) {
    userLogout(input: $input) {
      success
    }
  }
`

const useLogout = () => {
  const { resetState } = usePersistentStateContext()
  const [userLogoutMutation] = useUserLogoutMutation({
    fetchPolicy: "no-cache",
  })

  const logout = useCallback(
    async ({
      stateToDefault = true,
      token,
      isValidToken = true,
    }: LogoutOptions = {}): Promise<void> => {
      try {
        let context
        const deviceToken = await messaging().getToken()

        if (token) {
          await KeyStoreWrapper.removeSessionProfileByToken(token)
          context = { headers: { authorization: `Bearer ${token}` } }
        } else {
          await AsyncStorage.multiRemove([SCHEMA_VERSION_KEY])
          await KeyStoreWrapper.removeIsBiometricsEnabled()
          await KeyStoreWrapper.removePin()
          await KeyStoreWrapper.removePinAttempts()
          await KeyStoreWrapper.removeSessionProfiles()
        }

        logLogout()

        if (token && isValidToken) {
          await Promise.race([
            userLogoutMutation({
              context,
              variables: { input: { deviceToken } },
            }),
            // Create a promise that rejects after 2 seconds
            // this is handy for the case where the server is down, or in dev mode
            new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error("Logout mutation timeout"))
              }, 2000)
            }),
          ])
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
          console.debug({ err }, `error logout`)
        }
      } finally {
        if (stateToDefault) {
          resetState()
        }
      }
    },
    [resetState, userLogoutMutation],
  )

  return {
    logout,
  }
}

export default useLogout
