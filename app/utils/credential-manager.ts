import { signUpWithPassword } from "react-native-credentials-manager"

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
