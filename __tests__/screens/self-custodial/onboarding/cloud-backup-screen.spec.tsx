import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { IconHero } from "@app/components/icon-hero"
import { MigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { InfoBanner } from "@app/components/info-banner"
import { CloudBackupScreen } from "@app/screens/self-custodial/onboarding/cloud-backup-screen"
import theme from "@app/rne-theme/theme"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

const mockHandleBackup = jest.fn()
let mockLoading = false
let mockIsValid = true
const mockSetPassword = jest.fn()
const mockSetConfirmPassword = jest.fn()

jest.mock("@app/screens/self-custodial/onboarding/hooks", () => ({
  useCloudBackupForm: () => ({
    password: "",
    confirmPassword: "",
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

const mockUseMigrationBackupCheckpoint = jest.fn()

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationBackupCheckpoint: (step: string) => mockUseMigrationBackupCheckpoint(step),
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
  })

  it("renders title and subtitle", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(LL.BackupScreen.CloudBackup.title())).toBeTruthy()
  })

  it("always shows the password fields, the warning, and the continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(LL.BackupScreen.CloudBackup.password())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.confirmPassword())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.importantTitle())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.continueButton())).toBeTruthy()
  })

  it("calls handleBackup on continue press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(getByText(LL.BackupScreen.CloudBackup.continueButton()))
    expect(mockHandleBackup).toHaveBeenCalled()
  })

  /** With the checkbox gone, this disabled gate is the only thing keeping an empty or
   *  mismatched password out of `buildBackupPayload`, which now throws on one. */
  it("disables continue and does not back up while the form is invalid", async () => {
    mockIsValid = false

    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(getByText(LL.BackupScreen.CloudBackup.continueButton()))

    expect(mockHandleBackup).not.toHaveBeenCalled()
  })

  it("renders the Important InfoBanner with warning icon color", async () => {
    render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    const infoBannerMock = InfoBanner as unknown as jest.Mock
    const props = infoBannerMock.mock.calls[0][0]

    expect(props.icon).toBe("warning")
    expect(props.iconColor).toBe("warning")
    expect(props.title).toBe(LL.BackupScreen.CloudBackup.importantTitle())
  })

  it("renders the hero icon with the green color", async () => {
    render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    const iconHeroMock = IconHero as unknown as jest.Mock
    const props = iconHeroMock.mock.calls[0][0]

    expect(props.iconColor).toBe(theme.lightColors?._green)
    expect(props.icon).toBe("cloud")
  })

  it("delegates the CloudBackup checkpoint to the migration backup hook", async () => {
    render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(mockUseMigrationBackupCheckpoint).toHaveBeenCalledWith(
      MigrationCheckpoint.CloudBackup,
    )
  })
})
