import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { BackupPhraseSecurityChecks } from "@app/screens/spark-onboarding/manual-backup/backup-phrase-security-checks"

import { ContextForScreen } from "../helper"

jest.mock("@app/components/icon-hero", () => {
  const { Text } = jest.requireActual("react-native")
  return {
    IconHero: ({ title }: { title: string }) => <Text>{title}</Text>,
  }
})

loadLocale("en")
const LL = i18nObject("en")

describe("BackupPhraseSecurityChecks", () => {
  it("renders the title and only the first checkbox on mount", () => {
    const { getByText, queryByText } = render(
      <ContextForScreen>
        <BackupPhraseSecurityChecks onContinue={jest.fn()} />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.title())).toBeTruthy()
    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.check1())).toBeTruthy()
    expect(queryByText(LL.BackupScreen.ManualBackup.Alerts.check2())).toBeNull()
    expect(queryByText(LL.BackupScreen.ManualBackup.Alerts.check3())).toBeNull()
  })

  it("reveals the second checkbox after checking the first", () => {
    const { getByText } = render(
      <ContextForScreen>
        <BackupPhraseSecurityChecks onContinue={jest.fn()} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.check2())).toBeTruthy()
  })

  it("reveals the third checkbox after checking the second", () => {
    const { getByText } = render(
      <ContextForScreen>
        <BackupPhraseSecurityChecks onContinue={jest.fn()} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check2()))
    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.check3())).toBeTruthy()
  })

  it("does not call onContinue while any checkbox is unchecked", () => {
    const onContinue = jest.fn()
    const { getByText } = render(
      <ContextForScreen>
        <BackupPhraseSecurityChecks onContinue={onContinue} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.common.continue()))
    expect(onContinue).not.toHaveBeenCalled()
  })

  it("calls onContinue exactly once when all three checkboxes are checked", () => {
    const onContinue = jest.fn()
    const { getByText } = render(
      <ContextForScreen>
        <BackupPhraseSecurityChecks onContinue={onContinue} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check2()))
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check3()))

    fireEvent.press(getByText(LL.common.continue()))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it("keeps already-revealed checkboxes visible after toggling an earlier one off", () => {
    const { getByText } = render(
      <ContextForScreen>
        <BackupPhraseSecurityChecks onContinue={jest.fn()} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check2()))
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))

    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.check2())).toBeTruthy()
    expect(getByText(LL.BackupScreen.ManualBackup.Alerts.check3())).toBeTruthy()
  })

  it("re-enables the Continue button after re-checking the toggled-off box, and onContinue fires (Bug guard)", () => {
    const onContinue = jest.fn()
    const { getByText } = render(
      <ContextForScreen>
        <BackupPhraseSecurityChecks onContinue={onContinue} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check2()))
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check3()))
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.common.continue()))
    expect(onContinue).not.toHaveBeenCalled()

    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.common.continue()))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
