import { useCallback } from "react"
import { getReadableVersion } from "react-native-device-info"

import { useContactSupport } from "@app/hooks/use-contact-support"
import useDeviceLocation from "@app/hooks/use-device-location"
import { useI18nContext } from "@app/i18n/i18n-react"
import { MigrationSupportReason } from "@app/types/migration"
import { isIos } from "@app/utils/helper"

import { useMigrationDiagnostics } from "./use-migration-diagnostics"

const EMAIL_DIVIDER = "-".repeat(40)

/**
 * Composes and opens the migration support email: the account diagnostics plus the
 * platform, app version and country, framed so the user writes at the bottom. Mail
 * clients drop the cursor at the END of a mailto body, so the write-here prompt goes
 * last: the user lands right under it and the details block stays untouched. The
 * diagnostics are returned too, so the support screen renders the same single source.
 */
export const useMigrationSupportEmail = (reason: MigrationSupportReason) => {
  const { LL } = useI18nContext()
  const LLSupport = LL.AccountMigration.contactSupport
  const { composeSupport } = useContactSupport()
  const { countryCode } = useDeviceLocation()
  const diagnostics = useMigrationDiagnostics(reason)

  const sendSupportEmail = useCallback(() => {
    const platform = isIos ? "iOS" : "Android"
    const environmentLines = [
      { label: LLSupport.platformLabel(), value: platform },
      { label: LLSupport.appVersionLabel(), value: getReadableVersion() },
      { label: LLSupport.countryLabel(), value: countryCode ?? "" },
    ].filter((line) => Boolean(line.value))

    const infoLines = [...diagnostics, ...environmentLines].map(
      (line) => `${line.label}: ${line.value}`,
    )

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
  }, [LLSupport, diagnostics, countryCode, composeSupport])

  return { diagnostics, sendSupportEmail }
}
