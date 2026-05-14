import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { IconHero } from "@app/components/icon-hero"
import { InfoBanner } from "@app/components/info-banner"
import { CloudBackupScreen } from "@app/screens/self-custodial/onboarding/cloud-backup-screen"
import theme from "@app/rne-theme/theme"
import { ContextForScreen } from "../../helper"

const mockHandleBackup = jest.fn()
let mockLoading = false
let mockIsValid = true
let mockIsEncrypted = false
const mockToggleEncryption = jest.fn()
const mockSetPassword = jest.fn()
const mockSetConfirmPassword = jest.fn()

jest.mock("@app/screens/self-custodial/onboarding/hooks", () => ({
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
    IconHero: jest.fn(({ title, subtitle }: { title: string; subtitle: string }) => (
      <>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
      </>
    )),
  }
})

jest.mock("@app/components/info-banner", () => {
  const { Text } = jest.requireActual("react-native")
  return {
    InfoBanner: jest.fn(
      ({ title, children }: { title?: string; children: React.ReactNode }) => (
        <>
          {title ? <Text>{title}</Text> : null}
          {children}
        </>
      ),
    ),
  }
})

loadLocale("en")
const LL = i18nObject("en")

describe("CloudBackupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockIsValid = true
    mockIsEncrypted = false
  })

  it("renders title and subtitle", () => {
    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.CloudBackup.title())).toBeTruthy()
  })

  it("renders checkbox and continue button", () => {
    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.CloudBackup.encryptCheckbox())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.continueButton())).toBeTruthy()
  })

  it("does not show password fields when encryption is off", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )

    expect(queryByText(LL.BackupScreen.CloudBackup.password())).toBeNull()
  })

  it("shows password fields and warning when encryption is on", () => {
    mockIsEncrypted = true

    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.CloudBackup.password())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.confirmPassword())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.importantTitle())).toBeTruthy()
  })

  it("calls handleBackup on continue press", () => {
    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.CloudBackup.continueButton()))
    expect(mockHandleBackup).toHaveBeenCalled()
  })

  it("renders the Important InfoBanner with warning icon color", () => {
    mockIsEncrypted = true

    render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )

    const infoBannerMock = InfoBanner as unknown as jest.Mock
    const props = infoBannerMock.mock.calls[0][0]

    expect(props.icon).toBe("warning")
    expect(props.iconColor).toBe("warning")
    expect(props.title).toBe(LL.BackupScreen.CloudBackup.importantTitle())
  })

  it("renders the hero icon with the success color", () => {
    render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )

    const iconHeroMock = IconHero as unknown as jest.Mock
    const props = iconHeroMock.mock.calls[0][0]

    expect(props.iconColor).toBe(theme.lightColors?.success)
    expect(props.icon).toBe("cloud")
  })
})
