import { useMemo } from "react"

import { useI18nContext } from "@app/i18n/i18n-react"

import { useMigrationSupportDetails } from "./use-migration-support-details"

export type MigrationDiagnostic = {
  label: string
  value: string
  /** Identifiers are long hashes shown in the larger value font; the support screen renders
   *  them complete, never truncated, so support gets the whole string. */
  isIdentifier: boolean
}

/**
 * The labeled account diagnostics shared by the contact-support screen and the support
 * email: the custodial identity plus the provisioned wallet's pubkey, with the empty
 * values already filtered out. Identity only, no failure reason: the screen exists so the
 * user can copy who they are, and the reason is a code for support that the email carries.
 */
export const useMigrationDiagnostics = (): readonly MigrationDiagnostic[] => {
  const { LL } = useI18nContext()
  const LLSupport = LL.AccountMigration.contactSupport
  const { accountId, pubKey, username, email, phone } = useMigrationSupportDetails()

  return useMemo(
    () =>
      [
        { label: LLSupport.accountIdLabel(), value: accountId, isIdentifier: true },
        { label: LLSupport.pubKeyLabel(), value: pubKey, isIdentifier: true },
        { label: LLSupport.usernameLabel(), value: username, isIdentifier: false },
        { label: LLSupport.emailLabel(), value: email, isIdentifier: false },
        { label: LLSupport.phoneLabel(), value: phone, isIdentifier: false },
      ].filter((diagnostic) => Boolean(diagnostic.value)),
    [LLSupport, accountId, pubKey, username, email, phone],
  )
}
