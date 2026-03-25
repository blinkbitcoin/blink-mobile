import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupMethodScreen } from "@app/screens/spark-onboarding/backup-method-screen"
import { ContextForScreen } from "../helper"

const mockHandleKeychainBackup = jest.fn()
const mockHandleManualBackup = jest.fn()
let mockKeychainLoading = false

jest.mock("@app/screens/spark-onboarding/hooks", () => ({
  useBackupMethods: () => ({
    keychainLoading: mockKeychainLoading,
    handleKeychainBackup: mockHandleKeychainBackup,
    handleManualBackup: mockHandleManualBackup,
  }),
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
    mockKeychainLoading = false
  })

  it("renders title and subtitle", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.SparkOnboarding.BackupMethod.title())).toBeTruthy()
    expect(
      getByText(
        LL.SparkOnboarding.BackupMethod.subtitle({
          provider: LL.SparkOnboarding.BackupMethod.appleICloud(),
        }),
      ),
    ).toBeTruthy()
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

  it("calls handleManualBackup on manual backup press", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.BackupMethod.manualBackup()))
    expect(mockHandleManualBackup).toHaveBeenCalled()
  })

  it("calls handleKeychainBackup on password manager press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(getByText(LL.SparkOnboarding.BackupMethod.passwordManager()))
    })

    expect(mockHandleKeychainBackup).toHaveBeenCalled()
  })
})
