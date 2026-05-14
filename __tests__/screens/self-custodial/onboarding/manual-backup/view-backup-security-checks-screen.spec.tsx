import { readFileSync } from "fs"

import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ViewBackupSecurityChecksScreen } from "@app/screens/self-custodial/onboarding/manual-backup/view-backup-security-checks-screen"

import { ContextForScreen } from "../../../helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/components/icon-hero", () => {
  const { Text } = jest.requireActual("react-native")
  return {
    IconHero: ({ title }: { title: string }) => <Text>{title}</Text>,
  }
})

loadLocale("en")
const LL = i18nObject("en")

const renderScreen = () =>
  render(
    <ContextForScreen>
      <ViewBackupSecurityChecksScreen />
    </ContextForScreen>,
  )

const tickAllChecks = (getByText: ReturnType<typeof render>["getByText"]) => {
  fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
  fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check2()))
  fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check3()))
}

describe("ViewBackupSecurityChecksScreen — Settings flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the same alerts content as the onboarding flow (shared component)", () => {
    const { getByText } = renderScreen()
    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.title())).toBeTruthy()
    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.check1())).toBeTruthy()
  })

  it("does not depend on the migration-checkpoint hook — that responsibility belongs to the onboarding screen alone", () => {
    /** Static guarantee: the screen source must not pull in `@app/screens/account-migration/hooks`. */
    const source = readFileSync(
      require.resolve(
        "@app/screens/self-custodial/onboarding/manual-backup/view-backup-security-checks-screen",
      ),
      "utf8",
    )
    expect(source).not.toContain("account-migration")
    expect(source).not.toContain("useMigrationCheckpoint")
  })

  it("is registered in root-navigator under the matching route name — a missing registration would crash the Settings entry at runtime with no compile error", () => {
    const navigatorSource = readFileSync(
      require.resolve("@app/navigation/root-navigator"),
      "utf8",
    )
    expect(navigatorSource).toContain("ViewBackupSecurityChecksScreen")
    expect(navigatorSource).toContain('name="selfCustodialViewBackupSecurityChecks"')
  })

  it("Continue does not navigate while any check is missing", () => {
    const { getByText } = renderScreen()
    fireEvent.press(getByText(LL.common.continue()))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("Continue navigates to the Settings view-phrase screen (no PhraseStep) once all three are checked", () => {
    const { getByText } = renderScreen()
    tickAllChecks(getByText)
    fireEvent.press(getByText(LL.common.continue()))
    expect(mockNavigate).toHaveBeenCalledWith("sparkViewBackupPhraseScreen")
  })

  it("never navigates to the onboarding phrase screen — Settings stays separate from the onboarding flow", () => {
    const { getByText } = renderScreen()
    tickAllChecks(getByText)
    fireEvent.press(getByText(LL.common.continue()))
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupPhrase",
      expect.anything(),
    )
  })
})
