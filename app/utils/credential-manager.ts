import { signUpWithPassword } from "react-native-credentials-manager"

import { GaloyInstance } from "@app/config"

export const CredentialError = {
  NoProvider: "no-provider",
  UserCancelled: "user-cancelled",
  Unsupported: "unsupported",
  Unknown: "unknown",
} as const

export type CredentialError = (typeof CredentialError)[keyof typeof CredentialError]

export type CredentialSaveResult =
  | { success: true }
  | { success: false; error: CredentialError; cause?: unknown }

/** The codes the patched native module rejects a save with, after the exception's class
 *  (patches/react-native-credentials-manager+0.8.1.patch): its message is the provider's,
 *  which differs per provider and language. */
const SaveRejectionCode = {
  UserCanceled: "USER_CANCELED",
  NoCreateOption: "NO_CREATE_OPTION",
} as const

const classify = (message: string): CredentialError => {
  if (message.includes("CANCEL")) return CredentialError.UserCancelled
  if (message.includes("NO_CREDENTIAL_AVAILABLE")) return CredentialError.NoProvider
  return CredentialError.Unknown
}

export const mapCredentialError = (err: unknown): CredentialError => {
  if (!(err instanceof Error)) return CredentialError.Unknown
  const { code } = err as Error & { code?: unknown }
  if (code === SaveRejectionCode.UserCanceled) return CredentialError.UserCancelled
  if (code === SaveRejectionCode.NoCreateOption) return CredentialError.NoProvider
  return classify(err.message)
}

/** What the name of a two-factor setup key's entry ends with, apart from the wallet
 *  backups the same password manager holds for Blink. */
const SETUP_KEY_CREDENTIAL_SUFFIX = " (2FA)"

/** The name a two-factor setup key is saved under: its account, and what it is for. A key
 *  for any instance but production leads with that instance's name, as its authenticator
 *  entry does, so it is never taken for the production account's. */
export const setupKeyCredentialName = (
  account: string,
  { id, name }: Pick<GaloyInstance, "id" | "name">,
): string => {
  const isProductionInstance = id === "Main"
  if (isProductionInstance) return `${account}${SETUP_KEY_CREDENTIAL_SUFFIX}`
  return `${name}: ${account}${SETUP_KEY_CREDENTIAL_SUFFIX}`
}

/** Whether a saved entry is a two-factor setup key rather than a wallet backup: reading
 *  Blink's passwords back offers both. */
export const isSetupKeyCredential = (username: string): boolean =>
  username.endsWith(SETUP_KEY_CREDENTIAL_SUFFIX)

/**
 * Saves a username and password through Android's Credential Manager, whose system sheet
 * the user's password manager answers (Google Password Manager, Bitwarden and the like).
 * Android only: iOS has no API that raises its save sheet.
 */
export const savePasswordCredential = async (
  username: string,
  password: string,
): Promise<CredentialSaveResult> => {
  try {
    await signUpWithPassword({ username, password })
    return { success: true }
  } catch (err) {
    return { success: false, error: mapCredentialError(err), cause: err }
  }
}
