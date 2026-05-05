import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { signIn, signUpWithPassword } from "react-native-credentials-manager"
import * as Keychain from "react-native-keychain"

import { BLINK_DOMAIN } from "@app/config/appinfo"

export const CredentialError = {
  NoProvider: "no-provider",
  UserCancelled: "user-cancelled",
  Unsupported: "unsupported",
  Unknown: "unknown",
} as const

export type CredentialError = (typeof CredentialError)[keyof typeof CredentialError]

export type CredentialSaveResult =
  | { success: true }
  | { success: false; error: CredentialError }

export type CredentialReadResult =
  | { success: true; walletIdentifier: string; mnemonic: string }
  | { success: false; error: CredentialError }

export type UseCredentialBackupReturn = {
  save: (walletIdentifier: string, mnemonic: string) => Promise<CredentialSaveResult>
  read: () => Promise<CredentialReadResult>
  loading: boolean
}

const classify = (message: string): CredentialError => {
  if (message.includes("CANCEL")) return CredentialError.UserCancelled
  if (message.includes("NO_CREDENTIAL_AVAILABLE")) return CredentialError.NoProvider
  return CredentialError.Unknown
}

const mapCredentialError = (err: unknown): CredentialError =>
  err instanceof Error ? classify(err.message) : CredentialError.Unknown

const saveAndroid = async (
  walletIdentifier: string,
  mnemonic: string,
): Promise<CredentialSaveResult> => {
  try {
    await signUpWithPassword({ username: walletIdentifier, password: mnemonic })
    return { success: true }
  } catch (err) {
    return { success: false, error: mapCredentialError(err) }
  }
}

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
            return await saveAndroid(walletIdentifier, mnemonic)
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
