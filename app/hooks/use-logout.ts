import { useCallback } from "react"

import { gql } from "@apollo/client"
import { SCHEMA_VERSION_KEY } from "@app/config"
import { useUserLogoutMutation } from "@app/graphql/generated"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { logLogout } from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"
import AsyncStorage from "@react-native-async-storage/async-storage"
import messaging from "@react-native-firebase/messaging"

import KeyStoreWrapper from "../utils/storage/secureStorage"

type LogoutOptions = {
  stateToDefault?: boolean
  token?: string
  isValidToken?: boolean
  /**
   * Signs out of the active session and leaves everything the device has
   * stored alone: the saved profiles, the PIN, the biometrics flag and the
   * schema marker. For the one case where "there is nothing left" is not
   * knowledge but ignorance — the keystore could not be read, so erasing would
   * delete sessions we never saw.
   *
   * The group cannot be split. Profiles without the PIN would leave live
   * bearer tokens behind with the lock that guarded them gone, and dropping
   * the schema marker alone makes the next boot read as a fresh install, whose
   * reinstall sweep erases the profiles anyway.
   *
   * Only the untokened path reads this; a call that passes a token is already
   * scoped to that one session and destroys nothing else.
   */
  preserveStoredCredentials?: boolean
}

gql`
  mutation userLogout($input: UserLogoutInput!) {
    userLogout(input: $input) {
      success
    }
  }
`

const useLogout = () => {
  const { resetState, clearToken } = usePersistentStateContext()
  const [userLogoutMutation] = useUserLogoutMutation({
    fetchPolicy: "no-cache",
  })

  const logout = useCallback(
    async ({
      stateToDefault = true,
      token,
      isValidToken = true,
      preserveStoredCredentials = false,
    }: LogoutOptions = {}): Promise<void> => {
      try {
        // Isolated: a failed push-token fetch must never skip the local
        // key-store cleanup below. The server-side revocation is best-effort
        // and simply skipped without a device token.
        let deviceToken: string | undefined
        try {
          deviceToken = await messaging().getToken()
        } catch (err) {
          reportError("logout device token fetch", err)
        }

        let context: { headers: { authorization: string } } | undefined
        if (token) {
          await KeyStoreWrapper.removeSessionProfileByToken(token)
          // Removing the profile that backs the active session must also drop
          // the keychain token: a crash before the caller saves the next
          // token would otherwise resurrect a session whose profile is gone.
          // Via the provider, so its dirty-check ref learns the slot is empty —
          // a direct keystore removal would leave the ref stale and make every
          // later save skip the write it thinks already happened.
          const activeToken = await KeyStoreWrapper.getActiveToken()
          if (activeToken === token) {
            await clearToken()
          }
          context = { headers: { authorization: `Bearer ${token}` } }
        } else {
          if (!preserveStoredCredentials) {
            await AsyncStorage.multiRemove([SCHEMA_VERSION_KEY])
            await KeyStoreWrapper.removeIsBiometricsEnabled()
            await KeyStoreWrapper.removePin()
            await KeyStoreWrapper.clearPinFailureState()
            await KeyStoreWrapper.removeSessionProfiles()
          }
          await clearToken()
        }

        logLogout()

        if (token && isValidToken && deviceToken) {
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
          reportError("logout", err)
          console.debug({ err }, `error logout`)
        }
      } finally {
        if (stateToDefault) {
          resetState()
        }
      }
    },
    [resetState, clearToken, userLogoutMutation],
  )

  return {
    logout,
  }
}

export default useLogout
