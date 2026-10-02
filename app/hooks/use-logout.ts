import { useCallback } from "react"

import { gql } from "@apollo/client"
import { SCHEMA_VERSION_KEY } from "@app/config"
import { useUserLogoutMutation } from "@app/graphql/generated"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { logLogout } from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"
import {
  listSelfCustodialAccounts,
  StorageReadStatus,
} from "@app/self-custodial/storage/account-index"
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

type LogoutResult = {
  /**
   * Whether the app lock is still set once the logout is done. A caller that
   * leaves a lock screen behind has to know: a lock that was kept is still owed
   * an answer, and one that went is not there to ask for it.
   */
  readonly isAppLockKept: boolean
}

/**
 * Whether the app lock still has something on this device to guard once the
 * session is gone.
 *
 * A self-custodial wallet is stored on the device and outlives every logout:
 * nothing here erases it, and the account switcher opens it again for whoever
 * is holding the phone. The lock is the only thing between that person and the
 * wallet, so it stays for as long as one is stored. With none stored it goes,
 * as it always did: a lock with nothing behind it only locks its owner out.
 *
 * Fails closed: an index that cannot be read is not an index with no wallets.
 */
const hasStoredSelfCustodialWallet = async (): Promise<boolean> => {
  const wallets = await listSelfCustodialAccounts()
  if (wallets.status === StorageReadStatus.ReadFailed) return true
  return wallets.entries.length > 0
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
    }: LogoutOptions = {}): Promise<LogoutResult> => {
      /** Kept until its slots are seen to go: a teardown that threw part-way
       *  says nothing about them, and a caller told the lock went would walk a
       *  lock screen away from a lock that may still be set. */
      let isAppLockKept = true

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
          /** Keeping the stored credentials whole keeps the lock with them, and
           *  sessions that were not erased are sessions still stored. */
          let isLockOwed = true
          let areSavedSessionsErased = false

          if (!preserveStoredCredentials) {
            /** Asked before anything is erased, so that nothing sits between
             *  the erasures below for a kill to land on. */
            isLockOwed = await hasStoredSelfCustodialWallet()
            await AsyncStorage.multiRemove([SCHEMA_VERSION_KEY])
            areSavedSessionsErased = await KeyStoreWrapper.removeSessionProfiles()
          }
          await clearToken()

          /** The lock goes last, and only once what it guards is provably
           *  gone. The erasure above reports a failure rather than throwing
           *  one, and a lock dropped over sessions that are still stored would
           *  leave their tokens with nothing in front of them. A teardown cut
           *  short leaves a lock in front of what is left, never the reverse.
           *
           *  It is all three slots, kept or dropped together. A PIN without
           *  its spent attempt count hands the next round a fresh budget
           *  against a secret that no longer expires, and a PIN without the
           *  biometrics flag routes every later unlock to the keypad instead
           *  of to the prompt its owner chose. */
          const canDropLock = !isLockOwed && areSavedSessionsErased
          if (canDropLock) {
            const isBiometricsFlagErased =
              await KeyStoreWrapper.removeIsBiometricsEnabled()
            const isPinErased = await KeyStoreWrapper.removePin()
            const isSpentBudgetErased = await KeyStoreWrapper.clearPinFailureState()

            /** Gone only when every slot says so: one that could not be erased
             *  is a lock that is still set. */
            const isLockFullyErased =
              isBiometricsFlagErased && isPinErased && isSpentBudgetErased
            isAppLockKept = !isLockFullyErased
          }
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

      return { isAppLockKept }
    },
    [resetState, clearToken, userLogoutMutation],
  )

  return {
    logout,
  }
}

export default useLogout
