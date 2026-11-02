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
const mockUseCloudBackup = jest.fn()
const mockSetPassword = jest.fn()
const mockSetConfirmPassword = jest.fn()

jest.mock("@app/screens/self-custodial/onboarding/hooks", () => ({
  useCloudBackupForm: () => ({
    password: "ValidPass1234!",
    confirmPassword: "ValidPass1234!",
    setPassword: mockSetPassword,
    setConfirmPassword: mockSetConfirmPassword,
    passwordError: undefined,
    confirmPasswordError: undefined,
    isValid: mockIsValid,
  }),
  useCloudBackup: (args: unknown) => {
    mockUseCloudBackup(args)
    return {
      handleBackup: mockHandleBackup,
      loading: mockLoading,
    }
  },
}))

const mockReleaseScreenSecurity = jest.fn(() => Promise.resolve())
const mockAcquireScreenSecurity = jest.fn()
jest.mock("@app/utils/screen-security", () => ({
  acquireScreenSecurity: () => mockAcquireScreenSecurity(),
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

/** Settles the screen guard's lease, whose resolution updates the hook's state. */
const renderScreen = async () => {
  const rendered = render(
    <ContextForScreen>
      <CloudBackupScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return rendered
}

describe("CloudBackupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAcquireScreenSecurity.mockReturnValue({
      ready: Promise.resolve(),
      release: mockReleaseScreenSecurity,
    })
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

  it("renders the continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(LL.BackupScreen.CloudBackup.continueButton())).toBeTruthy()
  })

  /** The passphrase is mandatory, so the fields are ready on open with no
   *  checkbox to opt in first. */
  it("shows the passphrase fields and warning on open", async () => {
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
   * mount, so the first keystroke never lands on an unguarded frame.
   */
  describe("screenshot protection", () => {
    it("guards the encryption password", async () => {
      render(
        <ContextForScreen>
          <CloudBackupScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockAcquireScreenSecurity).toHaveBeenCalledTimes(1)
    })

    it("drops the guard on unmount", async () => {
      const { unmount } = render(
        <ContextForScreen>
          <CloudBackupScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      unmount()

      expect(mockReleaseScreenSecurity).toHaveBeenCalledTimes(1)
    })
  })

  /** The emergency bundle follows every cloud backup and is encrypted with the
   *  same seed, so a new cloud backup always carries a passphrase, and there is
   *  no choice about the bundle to make. */
  describe("mandatory passphrase and automatic bundle backups", () => {
    it("offers no checkbox to skip the passphrase or the automatic backups", async () => {
      const { queryByTestId } = await renderScreen()

      expect(queryByTestId("encrypt-checkbox")).toBeNull()
      expect(queryByTestId("auto-bundle-checkbox")).toBeNull()
    })

    it("always backs up with the passphrase", async () => {
      await renderScreen()

      expect(mockUseCloudBackup).toHaveBeenLastCalledWith({ password: "ValidPass1234!" })
    })

    it("keeps continue disabled until the passphrase is valid", async () => {
      mockIsValid = false
      const { getByText } = await renderScreen()

      fireEvent.press(getByText(LL.BackupScreen.CloudBackup.continueButton()))

      expect(mockHandleBackup).not.toHaveBeenCalled()
    })
  })

  describe("while a backup runs", () => {
    it("does not start a second backup", async () => {
      mockLoading = true
      const { getByTestId } = await renderScreen()

      fireEvent.press(getByTestId("cloud-backup-continue"))

      expect(mockHandleBackup).not.toHaveBeenCalled()
    })

    /** handleBackup holds the passphrase it started with, so an edit landing
     *  mid-upload would leave the screen showing one the backup never used. */
    it("keeps the passphrase fields fixed", async () => {
      mockLoading = true
      const { getByPlaceholderText } = await renderScreen()

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

    it("lets the passphrase be edited once no backup is running", async () => {
      const { getByPlaceholderText } = await renderScreen()

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
  })
})
