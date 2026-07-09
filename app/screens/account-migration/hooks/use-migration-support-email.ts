import { useCallback } from "react"
import { getReadableVersion } from "react-native-device-info"

import { useContactSupport } from "@app/hooks/use-contact-support"
import useDeviceLocation from "@app/hooks/use-device-location"
import { useI18nContext } from "@app/i18n/i18n-react"
import { isIos } from "@app/utils/helper"

import { useMigrationSupportDetails } from "./use-migration-support-details"

const EMAIL_DIVIDER = "-".repeat(40)

/**
 * Composes and opens the migration support email: the account diagnostics plus the
 * platform, app version and country, framed so the user writes at the bottom. Mail
 * clients drop the cursor at the END of a mailto body, so the write-here prompt goes
 * last: the user lands right under it and the details block stays untouched.
 */
export const useMigrationSupportEmail = () => {
  const { LL } = useI18nContext()
  const LLSupport = LL.AccountMigration.contactSupport
  const { composeSupport } = useContactSupport()
  const { countryCode } = useDeviceLocation()
  const { accountId, pubKey, username, email, phone } = useMigrationSupportDetails()

  const sendSupportEmail = useCallback(() => {
    const platform = isIos ? "iOS" : "Android"
    const infoLines = [
      { label: LLSupport.accountIdLabel(), value: accountId },
      { label: LLSupport.pubKeyLabel(), value: pubKey },
      { label: LLSupport.usernameLabel(), value: username },
      { label: LLSupport.emailLabel(), value: email },
      { label: LLSupport.phoneLabel(), value: phone },
      { label: LLSupport.platformLabel(), value: platform },
      { label: LLSupport.appVersionLabel(), value: getReadableVersion() },
      { label: LLSupport.countryLabel(), value: countryCode ?? "" },
    ]
      .filter((line) => Boolean(line.value))
      .map((line) => `${line.label}: ${line.value}`)

    const body = [
      LLSupport.emailAccountInfo(),
      EMAIL_DIVIDER,
      ...infoLines,
      EMAIL_DIVIDER,
      "",
      LLSupport.emailDescribeProblem(),
      "",
    ].join("\n")

    composeSupport({ subject: LLSupport.emailSubject(), body })
  }, [LLSupport, accountId, pubKey, username, email, phone, countryCode, composeSupport])

  return { sendSupportEmail }
}
