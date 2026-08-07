import { useMemo } from "react"

import { useI18nContext } from "@app/i18n/i18n-react"

import { useMigrationSupportDetails } from "./use-migration-support-details"

export type MigrationDiagnostic = {
  label: string
  value: string
}

/**
 * The labeled account diagnostics shared by the contact-support screen and the support
 * email: the custodial identity plus the provisioned wallet's pubkey, with the empty
 * values already filtered out. Identity only, no failure reason: the screen exists so the
 * user can copy who they are, and the reason is a code for support that the email carries.
 *
 * `custodialAccountId` covers the handover raised after the session was already discarded:
 * the `me` query is skipped for a signed-out custodial account, so without it the ticket
 * would name nothing that identifies the account support has to act on. It wins over the
 * query, which can still answer for another live session and name the wrong account.
 */
export const useMigrationDiagnostics = (
  custodialAccountId?: string,
): readonly MigrationDiagnostic[] => {
  const { LL } = useI18nContext()
  const LLSupport = LL.AccountMigration.contactSupport
  const { accountId, pubKey, username, email, phone } = useMigrationSupportDetails()
  const effectiveAccountId = custodialAccountId || accountId || ""

  return useMemo(
    () =>
      [
        {
          label: LLSupport.accountIdLabel(),
          value: effectiveAccountId,
          isIdentifier: true,
        },
        { label: LLSupport.pubKeyLabel(), value: pubKey, isIdentifier: true },
        { label: LLSupport.usernameLabel(), value: username, isIdentifier: false },
        { label: LLSupport.emailLabel(), value: email, isIdentifier: false },
        { label: LLSupport.phoneLabel(), value: phone, isIdentifier: false },
      ].filter((diagnostic) => Boolean(diagnostic.value)),
    [LLSupport, effectiveAccountId, pubKey, username, email, phone],
  )
}
