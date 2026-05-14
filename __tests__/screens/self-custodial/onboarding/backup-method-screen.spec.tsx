import React from "react"
import { Pressable, Text } from "react-native"

import { act, fireEvent, render } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { IconHero } from "@app/components/icon-hero"
import { SparkBackupMethodScreen } from "@app/screens/self-custodial/onboarding/backup-method-screen"
import theme from "@app/rne-theme/theme"
import { ContextForScreen } from "../../helper"

const mockHandleKeychainBackup = jest.fn()
const mockHandleCloudBackup = jest.fn()
const mockHandleManualBackup = jest.fn()
let mockKeychainLoading = false
let mockIsCloudBackupAvailable = true
let mockIsCredentialBackupAvailable = true

jest.mock("@app/screens/self-custodial/onboarding/hooks", () => ({
  useBackupMethods: () => ({
    isDriveBackupAvailable: mockIsCloudBackupAvailable,
    isCredentialBackupAvailable: mockIsCredentialBackupAvailable,
    credentialLoading: mockKeychainLoading,
    handleCredentialBackup: mockHandleKeychainBackup,
    handleCloudBackup: mockHandleCloudBackup,
    handleManualBackup: mockHandleManualBackup,
  }),
}))

const mockSaveCheckpoint = jest.fn()

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({
    saveCheckpoint: mockSaveCheckpoint,
  }),
  MigrationCheckpoint: { BackupMethod: "backupMethod" },
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({
    title,
    onPress,
    disabled,
  }: {
    title: string
    onPress: () => void
    disabled?: boolean
  }) => (
    <Pressable
      testID={`primary-${title}`}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
    >
      <Text>{title}</Text>
    </Pressable>
  ),
}))

jest.mock("@app/components/atomic/galoy-secondary-button", () => ({
  GaloySecondaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <Pressable testID={`secondary-${title}`} onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  ),
}))

jest.mock("@app/components/icon-hero", () => {
  return {
    IconHero: jest.fn(({ title, subtitle }: { title: string; subtitle: string }) => (
      <>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
      </>
    )),
  }
})

loadLocale("en")
const LL = i18nObject("en")

describe("SparkBackupMethodScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockKeychainLoading = false
    mockIsCloudBackupAvailable = true
    mockIsCredentialBackupAvailable = true
  })

  it("renders title and subtitle", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.BackupMethod.title())).toBeTruthy()
    expect(
      getByText(
        LL.BackupScreen.BackupMethod.subtitle({
          provider: LL.BackupScreen.BackupMethod.appleICloud(),
        }),
      ),
    ).toBeTruthy()
  })

  it("renders all three backup method buttons", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.BackupMethod.appleICloud())).toBeTruthy()
    expect(getByText(LL.BackupScreen.BackupMethod.passwordManager())).toBeTruthy()
    expect(getByText(LL.BackupScreen.BackupMethod.manualBackup())).toBeTruthy()
  })

  it("calls handleCloudBackup on cloud provider press", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.BackupMethod.appleICloud()))
    expect(mockHandleCloudBackup).toHaveBeenCalled()
  })

  it("calls handleManualBackup on manual backup press", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.BackupMethod.manualBackup()))
    expect(mockHandleManualBackup).toHaveBeenCalled()
  })

  it("calls handleCredentialBackup on password manager press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(getByText(LL.BackupScreen.BackupMethod.passwordManager()))
    })

    expect(mockHandleKeychainBackup).toHaveBeenCalled()
  })

  it("hides the password manager button when credential backup is unavailable (iOS multi-account)", () => {
    mockIsCredentialBackupAvailable = false

    const { queryByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(queryByText(LL.BackupScreen.BackupMethod.passwordManager())).toBeNull()
    expect(queryByText(LL.BackupScreen.BackupMethod.manualBackup())).toBeTruthy()
  })

  it("disables cloud backup and shows coming soon text when unavailable", () => {
    mockIsCloudBackupAvailable = false

    const { getByTestId, getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(
      getByTestId(`primary-${LL.BackupScreen.BackupMethod.appleICloud()}`).props
        .accessibilityState,
    ).toEqual({ disabled: true })
    expect(getByText(LL.BackupScreen.BackupMethod.iOSComingSoon())).toBeTruthy()
  })

  it("saves BackupMethod checkpoint on mount", () => {
    render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(mockSaveCheckpoint).toHaveBeenCalledWith("backupMethod")
  })

  it("renders the hero icon with the success color", () => {
    render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    const iconHeroMock = IconHero as unknown as jest.Mock
    const props = iconHeroMock.mock.calls[0][0]

    expect(props.iconColor).toBe(theme.lightColors?.success)
    expect(props.icon).toBe("cloud")
  })
})
