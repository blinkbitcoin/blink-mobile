import { useCallback } from "react"
import { Share } from "react-native"

import { authenticatorAccountLabel } from "@app/components/totp-export"
import { useTotpRegistrationScreenQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { SetupKeyBackupOption } from "@app/types/two-factor-enforcement"
import { logSetupKeyBackupOptionSelected } from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"

type SetupKeyBackup = {
  saveToPasswordManager: () => Promise<void>
  /** Reports a copy of the key for a manual backup. */
  reportManualCopy: () => void
}

/**
 * The ways to keep a new authenticator's setup key off this phone: the share sheet for a
 * password manager, or a copy. The backup is export only: Blink never reads it back, and
 * the key never goes to Blink's servers, logs or analytics, which report which option was
 * used and nothing more.
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

  /** The key with the account it is for, so the saved entry says which one it is. */
  const saveToPasswordManager = useCallback(async () => {
    logSetupKeyBackupOptionSelected({ option: SetupKeyBackupOption.PasswordManager })
    try {
      await Share.share({
        message: LL.AuthenticatorOnboarding.keyBackupText({ account, key: secret }),
      })
    } catch (err) {
      reportError("Setup key share", err)
    }
  }, [account, secret, LL])

  const reportManualCopy = useCallback(() => {
    logSetupKeyBackupOptionSelected({ option: SetupKeyBackupOption.ManualCopy })
  }, [])

  return { saveToPasswordManager, reportManualCopy }
}
