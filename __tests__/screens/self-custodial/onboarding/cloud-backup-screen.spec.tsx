import React from "react"
import { ActivityIndicator } from "react-native"
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
let mockIsEncrypted = false
let mockCanSyncBundle = false
let mockAutoBundleSync = false
let mockIsAutoBundleSyncKnown = false
let mockIsAutoBundleSyncLoading = false
const mockUseCloudBackup = jest.fn()
const mockToggleAutoBundleSync = jest.fn()
const mockToggleEncryption = jest.fn()
const mockSetPassword = jest.fn()
const mockSetConfirmPassword = jest.fn()

jest.mock("@app/screens/self-custodial/onboarding/hooks", () => ({
  useCloudBackupForm: () => ({
    isEncrypted: mockIsEncrypted,
    autoBundleSync: mockAutoBundleSync,
    isAutoBundleSyncKnown: mockIsAutoBundleSyncKnown,
    isAutoBundleSyncLoading: mockIsAutoBundleSyncLoading,
    canSyncBundle: mockCanSyncBundle,
    toggleAutoBundleSync: mockToggleAutoBundleSync,
    password: "",
    confirmPassword: "",
    toggleEncryption: mockToggleEncryption,
    setPassword: mockSetPassword,
    setConfirmPassword: mockSetConfirmPassword,
    passwordError: undefined,
    confirmPasswordError: undefined,
    isValid: mockIsValid,
  }),
  useCloudBackup: (params: unknown) => {
    mockUseCloudBackup(params)
    return {
      handleBackup: mockHandleBackup,
      loading: mockLoading,
    }
  },
}))

const mockEnableScreenSecurity = jest.fn()
const mockDisableScreenSecurity = jest.fn()
jest.mock("@app/utils/screen-security", () => ({
  enableScreenSecurity: (...args: readonly unknown[]) =>
    mockEnableScreenSecurity(...args),
  disableScreenSecurity: (...args: readonly unknown[]) =>
    mockDisableScreenSecurity(...args),
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

const renderScreen = () =>
  render(
    <ContextForScreen>
      <CloudBackupScreen />
    </ContextForScreen>,
  )

describe("CloudBackupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEnableScreenSecurity.mockResolvedValue(undefined)
    mockDisableScreenSecurity.mockResolvedValue(undefined)
    mockLoading = false
    mockIsValid = true
    mockIsEncrypted = false
    mockCanSyncBundle = false
    mockAutoBundleSync = false
    mockIsAutoBundleSyncKnown = false
    mockIsAutoBundleSyncLoading = false
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

  it("renders checkbox and continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(LL.BackupScreen.CloudBackup.encryptCheckbox())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.continueButton())).toBeTruthy()
  })

  it("does not show password fields when encryption is off", async () => {
    const { queryByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(queryByText(LL.BackupScreen.CloudBackup.password())).toBeNull()
  })

  it("shows password fields and warning when encryption is on", async () => {
    mockIsEncrypted = true

    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(LL.BackupScreen.CloudBackup.password())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.confirmPassword())).toBeTruthy()
    expect(getByText(LL.BackupScreen.CloudBackup.importantTitle())).toBeTruthy()
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

  /** useCloudBackup reports loading while the phrase is still being read and the pubkey
   *  derived. The hook refuses to run in that window; the screen's job is to show it, so the
   *  user sees a spinner instead of a button that looks idle. */
  it("shows the button in its loading state while the hook reports loading", async () => {
    mockLoading = true

    const view = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(view.UNSAFE_queryByType(ActivityIndicator)).toBeTruthy()
  })

  it("renders the Important InfoBanner with warning icon color", async () => {
    mockIsEncrypted = true

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

  /**
   * The encryption password is typed here, and PasswordInput's eye toggle shows it in
   * plain text, so a recents snapshot or a screen recorder would capture it. Guarded from
   * mount rather than from the moment encryption is switched on, so the first keystroke
   * never lands on an unguarded frame.
   */
  describe("screenshot protection", () => {
    it("guards the encryption password", async () => {
      mockIsEncrypted = true

      render(
        <ContextForScreen>
          <CloudBackupScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockEnableScreenSecurity).toHaveBeenCalledTimes(1)
    })

    it("guards the screen before encryption is switched on", async () => {
      render(
        <ContextForScreen>
          <CloudBackupScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockEnableScreenSecurity).toHaveBeenCalledTimes(1)
    })

    it("drops the guard on unmount", async () => {
      const { unmount } = render(
        <ContextForScreen>
          <CloudBackupScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      unmount()

      expect(mockDisableScreenSecurity).toHaveBeenCalledTimes(1)
    })
  })

  describe("automatic bundle backups", () => {
    it("explains that a password is needed before it can be turned on", () => {
      mockCanSyncBundle = false
      const { getByText } = renderScreen()

      expect(
        getByText(LL.BackupScreen.CloudBackup.autoBundleNeedsPassword()),
      ).toBeTruthy()
    })

    it("explains what it does once a password is in place", () => {
      mockCanSyncBundle = true
      const { getByText } = renderScreen()

      expect(getByText(LL.BackupScreen.CloudBackup.autoBundleHint())).toBeTruthy()
    })

    it("can be toggled once a password is in place", () => {
      mockCanSyncBundle = true
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId("auto-bundle-checkbox"))
      expect(mockToggleAutoBundleSync).toHaveBeenCalled()
    })

    /** The copy alone does not hold the gate: without this, dropping the
     *  disabled prop keeps every other case green while letting the user opt in
     *  with no password - exactly what D9 forbids. */
    it("refuses the press while no password is in place", () => {
      mockCanSyncBundle = false
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId("auto-bundle-checkbox"))

      expect(mockToggleAutoBundleSync).not.toHaveBeenCalled()
    })

    /** The backup commits the choices it started with; one changed mid-upload
     *  would show the user a choice other than the one stored. */
    it("keeps both choices fixed while the backup runs", () => {
      mockCanSyncBundle = true
      mockLoading = true
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId("auto-bundle-checkbox"))
      fireEvent.press(getByTestId("encrypt-checkbox"))

      expect(mockToggleAutoBundleSync).not.toHaveBeenCalled()
      expect(mockToggleEncryption).not.toHaveBeenCalled()
    })

    /** handleBackup holds the passphrase it started with, so an edit landing
     *  mid-upload would leave the screen showing one the backup never used. */
    it("keeps the passphrase fields fixed while the backup runs", () => {
      mockIsEncrypted = true
      mockLoading = true
      const { getByPlaceholderText } = renderScreen()

      fireEvent.changeText(
        getByPlaceholderText(LL.BackupScreen.CloudBackup.passwordPlaceholder()),
        "a different passphrase",
      )
      fireEvent.changeText(
        getByPlaceholderText(LL.BackupScreen.CloudBackup.confirmPasswordPlaceholder()),
        "a different passphrase",
      )

      expect(mockSetPassword).not.toHaveBeenCalled()
      expect(mockSetConfirmPassword).not.toHaveBeenCalled()
    })

    it("does not start a second backup while one runs", () => {
      mockIsEncrypted = true
      mockLoading = true
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId("cloud-backup-continue"))

      expect(mockHandleBackup).not.toHaveBeenCalled()
    })

    it("lets the passphrase be edited while no backup is running", () => {
      mockIsEncrypted = true
      const { getByPlaceholderText } = renderScreen()

      fireEvent.changeText(
        getByPlaceholderText(LL.BackupScreen.CloudBackup.passwordPlaceholder()),
        "a new passphrase",
      )
      fireEvent.changeText(
        getByPlaceholderText(LL.BackupScreen.CloudBackup.confirmPasswordPlaceholder()),
        "a new passphrase",
      )

      expect(mockSetPassword).toHaveBeenCalledWith("a new passphrase")
      expect(mockSetConfirmPassword).toHaveBeenCalledWith("a new passphrase")
    })

    it("waits for the stored choice before it can be changed or committed", () => {
      mockCanSyncBundle = true
      mockIsAutoBundleSyncLoading = true
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId("auto-bundle-checkbox"))
      fireEvent.press(getByTestId("cloud-backup-continue"))

      expect(mockToggleAutoBundleSync).not.toHaveBeenCalled()
      expect(mockHandleBackup).not.toHaveBeenCalled()
    })

    it("tells the backup whether the choice shown is one it may store", () => {
      mockIsAutoBundleSyncKnown = true
      renderScreen()

      expect(mockUseCloudBackup).toHaveBeenCalledWith(
        expect.objectContaining({ isAutoBundleSyncKnown: true }),
      )
    })
  })
})
