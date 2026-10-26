import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { signIn } from "react-native-credentials-manager"
import * as Keychain from "react-native-keychain"

import { BLINK_DOMAIN } from "@app/config/appinfo"
import {
  CredentialError,
  CredentialSaveResult,
  mapCredentialError,
  savePasswordCredential,
} from "@app/utils/credential-manager"

export { CredentialError }
export type { CredentialSaveResult }

export type CredentialReadResult =
  | { success: true; walletIdentifier: string; mnemonic: string }
  | { success: false; error: CredentialError }

export type UseCredentialBackupReturn = {
  save: (walletIdentifier: string, mnemonic: string) => Promise<CredentialSaveResult>
  read: () => Promise<CredentialReadResult>
  loading: boolean
}

/**
 * iOS Keychain Internet Password keys without `kSecAttrAccount` collapse
 * multiple matches to one OS-picked entry, silently stranding wallets.
 */
export const isCredentialBackupAvailable = (existingAccountCount: number): boolean =>
  Platform.OS !== "ios" || existingAccountCount <= 1

const saveIOS = async (
  walletIdentifier: string,
  mnemonic: string,
): Promise<CredentialSaveResult> => {
  try {
    const result = await Keychain.setInternetCredentials(
      BLINK_DOMAIN,
      walletIdentifier,
      mnemonic,
      {
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
        cloudSync: true,
      },
    )
    if (result === false) return { success: false, error: CredentialError.Unknown }
    return { success: true }
  } catch (err) {
    return { success: false, error: mapCredentialError(err) }
  }
}

const readAndroid = async (): Promise<CredentialReadResult> => {
  try {
    const credential = await signIn(["password"] as const, {})
    return {
      success: true,
      walletIdentifier: credential.username,
      mnemonic: credential.password,
    }
  } catch (err) {
    return { success: false, error: mapCredentialError(err) }
  }
}

const readIOS = async (): Promise<CredentialReadResult> => {
  try {
    const credentials = await Keychain.getInternetCredentials(BLINK_DOMAIN)
    if (!credentials) return { success: false, error: CredentialError.NoProvider }
    return {
      success: true,
      walletIdentifier: credentials.username,
      mnemonic: credentials.password,
    }
  } catch (err) {
    return { success: false, error: mapCredentialError(err) }
  }
}

export const useCredentialBackup = (): UseCredentialBackupReturn => {
  const [loading, setLoading] = useState(false)

  const save = useCallback(
    async (walletIdentifier: string, mnemonic: string): Promise<CredentialSaveResult> => {
      setLoading(true)
      try {
        switch (Platform.OS) {
          case "android":
            return await savePasswordCredential(walletIdentifier, mnemonic)
          case "ios":
            return await saveIOS(walletIdentifier, mnemonic)
          default:
            return { success: false, error: CredentialError.Unsupported }
        }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const read = useCallback(async (): Promise<CredentialReadResult> => {
    setLoading(true)
    try {
      switch (Platform.OS) {
        case "android":
          return await readAndroid()
        case "ios":
          return await readIOS()
        default:
          return { success: false, error: CredentialError.Unsupported }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { save, read, loading }
}
