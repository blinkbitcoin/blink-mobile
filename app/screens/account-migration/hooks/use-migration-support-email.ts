import { useCallback } from "react"
import { getReadableVersion } from "react-native-device-info"

import { useContactSupport } from "@app/hooks/use-contact-support"
import useDeviceLocation from "@app/hooks/use-device-location"
import { useI18nContext } from "@app/i18n/i18n-react"
import { MigrationSupportReason } from "@app/types/migration"
import { isIos } from "@app/utils/helper"

import { MigrationDiagnostic, useMigrationDiagnostics } from "./use-migration-diagnostics"

const EMAIL_DIVIDER = "-".repeat(40)

/**
 * Builds the migration support payload once for the error screen, the clipboard and the
 * email, so the three can never drift. `cardDetails` is what the screen shows: the failure
 * reason first, then the account identity. `supportDetailsText` is the full block (the card
 * details plus platform, app version and country) that the copy control and the email body
 * share. The reason value stays an untranslated code, greppable whatever the user's locale;
 * only its label is localized. The email frames the block so the write-here prompt lands
 * last, where mail clients drop the cursor at the end of a mailto body.
 */
export const useMigrationSupportEmail = (reason: MigrationSupportReason) => {
  const { LL } = useI18nContext()
  const LLSupport = LL.AccountMigration.contactSupport
  const { composeSupport } = useContactSupport()
  const { countryCode } = useDeviceLocation()
  const diagnostics = useMigrationDiagnostics()
  const platform = isIos ? "iOS" : "Android"

  const cardDetails: MigrationDiagnostic[] = [
    { label: LLSupport.reasonLabel(), value: reason, isIdentifier: false },
    ...diagnostics,
  ].filter((line) => Boolean(line.value))

  const supportDetails: MigrationDiagnostic[] = [
    ...cardDetails,
    { label: LLSupport.platformLabel(), value: platform, isIdentifier: false },
    {
      label: LLSupport.appVersionLabel(),
      value: getReadableVersion(),
      isIdentifier: false,
    },
    { label: LLSupport.countryLabel(), value: countryCode ?? "", isIdentifier: false },
  ].filter((line) => Boolean(line.value))

  const supportDetailsText = supportDetails
    .map(({ label, value }) => `${label}: ${value}`)
    .join("\n")

  const sendSupportEmail = useCallback(() => {
    const body = [
      LLSupport.emailAccountInfo(),
      EMAIL_DIVIDER,
      supportDetailsText,
      EMAIL_DIVIDER,
      "",
      LLSupport.emailDescribeProblem(),
      "",
    ].join("\n")

    composeSupport({ subject: LLSupport.emailSubject(), body })
  }, [LLSupport, supportDetailsText, composeSupport])

  return { cardDetails, supportDetailsText, sendSupportEmail }
}
