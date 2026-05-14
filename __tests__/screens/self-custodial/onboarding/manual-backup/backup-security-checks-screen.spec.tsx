import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { PhraseStep } from "@app/navigation/stack-param-lists"
import { BackupSecurityChecksScreen } from "@app/screens/self-custodial/onboarding/manual-backup/backup-security-checks-screen"

import { ContextForScreen } from "../../../helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockSaveCheckpoint = jest.fn()
jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({
    saveCheckpoint: mockSaveCheckpoint,
  }),
  MigrationCheckpoint: { BackupAlerts: "backupAlerts" },
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
      <BackupSecurityChecksScreen />
    </ContextForScreen>,
  )

const tickAllChecks = (getByText: ReturnType<typeof render>["getByText"]) => {
  fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
  fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check2()))
  fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check3()))
}

describe("BackupSecurityChecksScreen — onboarding flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the security checks content (delegates UI to BackupPhraseSecurityChecks)", () => {
    const { getByText } = renderScreen()
    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.title())).toBeTruthy()
    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.check1())).toBeTruthy()
  })

  it("saves BackupAlerts migration checkpoint on mount — onboarding-only concern", () => {
    renderScreen()
    expect(mockSaveCheckpoint).toHaveBeenCalledWith("backupAlerts")
  })

  it("Continue does not navigate while any check is missing", () => {
    const { getByText } = renderScreen()
    fireEvent.press(getByText(LL.common.continue()))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("Continue navigates to the onboarding phrase screen on PhraseStep.First once all three are checked", () => {
    const { getByText } = renderScreen()
    tickAllChecks(getByText)
    fireEvent.press(getByText(LL.common.continue()))
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupPhrase", {
      step: PhraseStep.First,
    })
  })

  it("never navigates to the Settings view-phrase screen — onboarding stays separate from the Settings flow", () => {
    const { getByText } = renderScreen()
    tickAllChecks(getByText)
    fireEvent.press(getByText(LL.common.continue()))
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "sparkViewBackupPhraseScreen",
      expect.anything(),
    )
    expect(mockNavigate).not.toHaveBeenCalledWith("sparkViewBackupPhraseScreen")
  })
})
