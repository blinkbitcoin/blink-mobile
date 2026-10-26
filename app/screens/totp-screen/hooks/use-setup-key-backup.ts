import { useCallback } from "react"
import { Platform } from "react-native"

import { authenticatorAccountLabel, compactSetupKey } from "@app/components/totp-export"
import { useTotpRegistrationScreenQuery } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { SetupKeyBackupOption } from "@app/types/two-factor-enforcement"
import { logSetupKeyBackupOptionSelected } from "@app/utils/analytics"
import {
  CredentialError,
  CredentialSaveResult,
  savePasswordCredential,
  setupKeyCredentialName,
} from "@app/utils/credential-manager"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

type SetupKeyBackup = {
  saveToPasswordManager: () => Promise<void>
  /** Reports a copy of the key for a manual backup. */
  reportManualCopy: () => void
}

const UNSUPPORTED: CredentialSaveResult = {
  success: false,
  error: CredentialError.Unsupported,
}

/** What a save that did not land says, as the self-custodial backup says it: nothing for
 *  a user who declined the sheet. */
const showSaveErrorToast = (
  result: Extract<CredentialSaveResult, { success: false }>,
  LL: TranslationFunctions,
): void => {
  switch (result.error) {
    case CredentialError.UserCancelled:
      return
    case CredentialError.NoProvider:
    case CredentialError.Unsupported:
      toastShow({ message: LL.AuthenticatorOnboarding.passwordManagerUnavailable(), LL })
      return
    case CredentialError.Unknown:
      reportError("Setup key password manager save", result.cause ?? result.error)
      toastShow({
        message: LL.BackupScreen.BackupMethod.passwordManagerBackupFailed(),
        LL,
      })
      return
    default: {
      const _exhaustive: never = result.error
      throw new Error(`Unknown credential error: ${_exhaustive}`)
    }
  }
}

/**
 * The ways to keep a new authenticator's setup key off this phone: a password manager, or
 * a copy. The password manager is Android's, through the system's Credential Manager, as
 * the self-custodial backup saves to it; iOS has no API that raises its save sheet, so
 * the screen offers it on Android only. The backup is export only: Blink never reads it
 * back, and the key never goes to Blink's servers, logs or analytics, which report which
 * option was used and nothing more.
 */
export const useSetupKeyBackup = ({
  secret,
  userId,
}: RootStackParamList["totpRegistrationBackup"]): SetupKeyBackup => {
  const { LL } = useI18nContext()
  /** The username, read from the cache the setup key's screen filled, named as the
   *  authenticator's entry names it. */
  const { data } = useTotpRegistrationScreenQuery()
  const account = authenticatorAccountLabel({ id: userId, username: data?.me?.username })
  const {
    appConfig: { galoyInstance },
  } = useAppConfig()

  /** Saved as a password whose username names the account, its instance outside
   *  production, and what it is for, apart from the wallet backups the same manager may
   *  hold, and whose password is the key as an authenticator takes it in. */
  const save = useCallback(async () => {
    logSetupKeyBackupOptionSelected({ option: SetupKeyBackupOption.PasswordManager })
    const canRaiseSaveSheet = Platform.OS === "android"
    const result = canRaiseSaveSheet
      ? await savePasswordCredential(
          setupKeyCredentialName(account, galoyInstance),
          compactSetupKey(secret),
        )
      : UNSUPPORTED
    if (!result.success) {
      showSaveErrorToast(result, LL)
      return
    }
    toastShow({
      message: LL.BackupScreen.BackupMethod.passwordManagerBackupSaved(),
      type: "success",
      LL,
    })
  }, [account, galoyInstance, secret, LL])

  /** A second tap while the sheet is coming up would raise another. */
  const { run } = useInFlightGuard()
  const saveToPasswordManager = useCallback(async () => {
    await run(save)
  }, [run, save])

  const reportManualCopy = useCallback(() => {
    logSetupKeyBackupOptionSelected({ option: SetupKeyBackupOption.ManualCopy })
  }, [])

  return { saveToPasswordManager, reportManualCopy }
}
