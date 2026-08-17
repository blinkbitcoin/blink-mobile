import React from "react"
import { renderHook } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useMigrationDiagnostics } from "@app/screens/account-migration/hooks/use-migration-diagnostics"

loadLocale("en")
const LLSupport = i18nObject("en").AccountMigration.contactSupport

const EMPTY_DETAILS = {
  accountId: "",
  pubKey: "",
  username: "",
  email: "",
  phone: "",
}

let mockDetails = { ...EMPTY_DETAILS }

jest.mock("@app/screens/account-migration/hooks/use-migration-support-details", () => ({
  useMigrationSupportDetails: () => mockDetails,
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TypesafeI18n locale="en">{children}</TypesafeI18n>
)

const diagnose = (custodialAccountId?: string) =>
  renderHook(() => useMigrationDiagnostics(custodialAccountId), { wrapper }).result
    .current

const accountIdValue = (custodialAccountId?: string) =>
  diagnose(custodialAccountId).find(
    (diagnostic) => diagnostic.label === LLSupport.accountIdLabel(),
  )?.value

describe("useMigrationDiagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockDetails = {
      accountId: "queried-account",
      pubKey: "02abc123pubkey",
      username: "satoshin21",
      email: "email@email.com",
      phone: "+1 374 9383 993",
    }
  })

  it("names the queried account when the handover carries no id", () => {
    expect(accountIdValue()).toBe("queried-account")
  })

  /** The caller passes the id of the account the ticket is about; a live query can still
   *  answer for another session and would name an account support must not touch. */
  it("prefers the id the handover was raised with", () => {
    expect(accountIdValue("handover-account")).toBe("handover-account")
  })

  it("falls back to the queried account when the handover id is empty", () => {
    expect(accountIdValue("")).toBe("queried-account")
  })

  /** The `me` query is skipped once the session is gone, so the passed id is all that is
   *  left to identify the account. */
  it("names the handover account when the session is already discarded", () => {
    mockDetails = { ...EMPTY_DETAILS }

    expect(accountIdValue("handover-account")).toBe("handover-account")
  })

  it("drops the account row when neither source has an id", () => {
    mockDetails = { ...EMPTY_DETAILS }

    expect(accountIdValue()).toBeUndefined()
  })

  it("keeps the remaining identity rows", () => {
    const labels = diagnose().map((diagnostic) => diagnostic.label)

    expect(labels).toEqual([
      LLSupport.accountIdLabel(),
      LLSupport.pubKeyLabel(),
      LLSupport.usernameLabel(),
      LLSupport.emailLabel(),
      LLSupport.phoneLabel(),
    ])
  })

  it("marks the identifiers so the screen renders them complete", () => {
    const identifiers = diagnose()
      .filter((diagnostic) => diagnostic.isIdentifier)
      .map((diagnostic) => diagnostic.label)

    expect(identifiers).toEqual([LLSupport.accountIdLabel(), LLSupport.pubKeyLabel()])
  })
})
