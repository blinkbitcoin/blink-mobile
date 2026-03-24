import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupMethodScreen } from "@app/screens/spark-onboarding/backup-method-screen"
import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/components/icon-hero", () => {
  const { Text } = jest.requireActual("react-native")
  return {
    IconHero: ({ title, subtitle }: { title: string; subtitle: string }) => (
      <>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
      </>
    ),
  }
})

loadLocale("en")
const LL = i18nObject("en")

describe("SparkBackupMethodScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders all buttons", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.SparkOnboarding.BackupMethod.googleDrive())).toBeTruthy()
    expect(getByText(LL.SparkOnboarding.BackupMethod.passwordManager())).toBeTruthy()
    expect(getByText(LL.SparkOnboarding.BackupMethod.manualBackup())).toBeTruthy()
  })

  it("renders title and subtitle", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.SparkOnboarding.BackupMethod.title())).toBeTruthy()
    expect(getByText(LL.SparkOnboarding.BackupMethod.subtitle())).toBeTruthy()
  })

  it("navigates to alerts screen on manual backup press", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.BackupMethod.manualBackup()))
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupAlertsScreen")
  })
})
