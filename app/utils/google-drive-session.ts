/**
 * Sign-in setup and dead-token recovery shared by every Drive caller,
 * interactive or silent. Lives apart from google-drive-client.ts so that
 * module stays pure fetch; this one needs the sign-in SDK.
 */

import { GoogleSignin } from "@react-native-google-signin/google-signin"

import { DriveError } from "@app/utils/google-drive-client"

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"

/**
 * Safe to call before every Drive session. Drive is the Android backup
 * provider (iOS uses iCloud), and there configure only rebuilds the sign-in
 * client from these options while keeping the signed-in account, so calling
 * it again neither signs the user out nor changes the requested scopes.
 */
export const configureGoogleSignIn = (): void => {
  GoogleSignin.configure({ scopes: [DRIVE_SCOPE] })
}

/** Not `reason`: 403 shares it but means a withheld permission, which a new token cannot fix. */
export const isDeadAccessToken = (err: unknown): boolean =>
  err instanceof DriveError && err.status === 401

/**
 * A revoked token stays in the sign-in cache, so the SDK keeps handing back the same dead
 * one. Clearing it forces a refresh, retried once. The working token comes back because the
 * caller holds it for the rest of the session.
 */
export const callDrive = async <T>(
  token: string,
  call: (token: string) => Promise<T>,
): Promise<{ value: T; token: string }> => {
  try {
    return { value: await call(token), token }
  } catch (err) {
    if (!isDeadAccessToken(err)) throw err

    let refreshed: string
    try {
      await GoogleSignin.clearCachedAccessToken(token)
      refreshed = (await GoogleSignin.getTokens()).accessToken
    } catch {
      /** The 401 is the diagnosis; a failure to refresh only says the retry never ran. */
      throw err
    }

    return { value: await call(refreshed), token: refreshed }
  }
}
