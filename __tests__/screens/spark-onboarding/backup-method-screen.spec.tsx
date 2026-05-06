import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { Pressable, Text } from "react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupMethodScreen } from "@app/screens/spark-onboarding/backup-method-screen"
import { ContextForScreen } from "../helper"

const mockHandleKeychainBackup = jest.fn()
const mockHandleCloudBackup = jest.fn()
const mockHandleManualBackup = jest.fn()
let mockKeychainLoading = false
let mockIsCloudBackupAvailable = true

jest.mock("@app/screens/spark-onboarding/hooks", () => ({
  useBackupMethods: () => ({
    isCloudBackupAvailable: mockIsCloudBackupAvailable,
    keychainLoading: mockKeychainLoading,
    handleKeychainBackup: mockHandleKeychainBackup,
    handleCloudBackup: mockHandleCloudBackup,
    handleManualBackup: mockHandleManualBackup,
  }),
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
    mockIsCloudBackupAvailable = true
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

    expect(getByText(LL.SparkOnboarding.BackupMethod.appleICloud())).toBeTruthy()
    expect(getByText(LL.SparkOnboarding.BackupMethod.passwordManager())).toBeTruthy()
    expect(getByText(LL.SparkOnboarding.BackupMethod.manualBackup())).toBeTruthy()
  })

  it("calls handleCloudBackup on cloud provider press", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.BackupMethod.appleICloud()))
    expect(mockHandleCloudBackup).toHaveBeenCalled()
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

  it("disables cloud backup and shows coming soon text when unavailable", () => {
    mockIsCloudBackupAvailable = false

    const { getByTestId, getByText } = render(
      <ContextForScreen>
        <SparkBackupMethodScreen />
      </ContextForScreen>,
    )

    expect(
      getByTestId(`primary-${LL.SparkOnboarding.BackupMethod.appleICloud()}`).props
        .accessibilityState,
    ).toEqual({ disabled: true })
    expect(getByText(LL.SparkOnboarding.BackupMethod.iOSComingSoon())).toBeTruthy()
  })
})
