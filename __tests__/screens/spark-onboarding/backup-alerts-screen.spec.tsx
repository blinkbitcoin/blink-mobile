import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupAlertsScreen } from "@app/screens/spark-onboarding/manual-backup/backup-alerts-screen"
import { ContextForScreen } from "../helper"

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

describe("SparkBackupAlertsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders title and first checkbox only", () => {
    const { getByText, queryByText } = render(
      <ContextForScreen>
        <SparkBackupAlertsScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.SparkOnboarding.ManualBackup.Alerts.title())).toBeTruthy()
    expect(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check1())).toBeTruthy()
    expect(queryByText(LL.SparkOnboarding.ManualBackup.Alerts.check2())).toBeNull()
    expect(queryByText(LL.SparkOnboarding.ManualBackup.Alerts.check3())).toBeNull()
  })

  it("reveals second checkbox after checking first", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupAlertsScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check1()))
    expect(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check2())).toBeTruthy()
  })

  it("reveals third checkbox after checking second", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupAlertsScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check2()))
    expect(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check3())).toBeTruthy()
  })

  it("continue button is disabled when not all checkboxes are checked", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupAlertsScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.common.continue()))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("continue button navigates after all checkboxes are checked", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupAlertsScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check2()))
    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check3()))

    fireEvent.press(getByText(LL.common.continue()))
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupPhraseScreen")
  })

  it("keeps revealed checkboxes visible after unchecking", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupAlertsScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check1()))
    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check2()))

    // Uncheck first — second and third should remain visible
    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check1()))

    expect(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check2())).toBeTruthy()
    expect(getByText(LL.SparkOnboarding.ManualBackup.Alerts.check3())).toBeTruthy()
  })
})
