import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkCloudBackupScreen } from "@app/screens/spark-onboarding/cloud-backup-screen"
import { ContextForScreen } from "../helper"

const mockHandleBackup = jest.fn()
let mockLoading = false
let mockIsValid = true
let mockIsEncrypted = false
const mockToggleEncryption = jest.fn()
const mockSetPassword = jest.fn()
const mockSetConfirmPassword = jest.fn()

jest.mock("@app/screens/spark-onboarding/hooks", () => ({
  useCloudBackupForm: () => ({
    isEncrypted: mockIsEncrypted,
    password: "",
    confirmPassword: "",
    toggleEncryption: mockToggleEncryption,
    setPassword: mockSetPassword,
    setConfirmPassword: mockSetConfirmPassword,
    passwordError: undefined,
    confirmPasswordError: undefined,
    isValid: mockIsValid,
  }),
  useCloudBackup: () => ({
    handleBackup: mockHandleBackup,
    loading: mockLoading,
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

describe("SparkCloudBackupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockIsValid = true
    mockIsEncrypted = false
  })

  it("renders title and subtitle", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkCloudBackupScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.CloudBackup.title())).toBeTruthy()
  })

  it("renders checkbox and continue button", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkCloudBackupScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.CloudBackup.encryptCheckbox())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.continueButton())).toBeTruthy()
  })

  it("does not show password fields when encryption is off", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <SparkCloudBackupScreen />
      </ContextForScreen>,
    )

    expect(queryByText(LL.BackupScreen.CloudBackup.password())).toBeNull()
  })

  it("shows password fields and warning when encryption is on", () => {
    mockIsEncrypted = true

    const { getByText } = render(
      <ContextForScreen>
        <SparkCloudBackupScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.CloudBackup.password())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.confirmPassword())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.importantTitle())).toBeTruthy()
  })

  it("calls handleBackup on continue press", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkCloudBackupScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.CloudBackup.continueButton()))
    expect(mockHandleBackup).toHaveBeenCalled()
  })
})
