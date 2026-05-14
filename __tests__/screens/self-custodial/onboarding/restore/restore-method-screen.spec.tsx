import React from "react"
import { Pressable, Text } from "react-native"

import { act, fireEvent, render } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { IconHero } from "@app/components/icon-hero"
import { RestoreMethodScreen } from "@app/screens/self-custodial/onboarding/restore/restore-method-screen"
import theme from "@app/rne-theme/theme"

import { ContextForScreen } from "../../../helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockRead = jest.fn()
let mockLoading = false

jest.mock("@app/screens/self-custodial/onboarding/hooks/use-credential-backup", () => ({
  CredentialError: {
    NoProvider: "no-provider",
    UserCancelled: "user-cancelled",
    Unsupported: "unsupported",
    Unknown: "unknown",
  },
  useCredentialBackup: () => ({
    save: jest.fn(),
    read: mockRead,
    loading: mockLoading,
  }),
}))

const mockRestore = jest.fn()
jest.mock(
  "@app/screens/self-custodial/onboarding/restore/hooks/use-restore-wallet",
  () => ({
    useRestoreWallet: () => ({ restore: mockRestore }),
  }),
)

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <Pressable testID={`primary-${title}`} onPress={onPress}>
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

jest.mock("@app/components/icon-hero", () => ({
  IconHero: jest.fn(({ title, subtitle }: { title: string; subtitle: string }) => (
    <>
      <Text>{title}</Text>
      <Text>{subtitle}</Text>
    </>
  )),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("RestoreMethodScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
  })

  it("renders the hero icon with the success color", () => {
    render(
      <ContextForScreen>
        <RestoreMethodScreen />
      </ContextForScreen>,
    )

    const iconHeroMock = IconHero as unknown as jest.Mock
    const props = iconHeroMock.mock.calls[0][0]

    expect(props.iconColor).toBe(theme.lightColors?.success)
    expect(props.icon).toBe("cloud")
  })

  it("navigates to the cloud restore screen when the cloud button is pressed", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <RestoreMethodScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByTestId(`primary-${LL.BackupScreen.BackupMethod.appleICloud()}`))
    expect(mockNavigate).toHaveBeenCalledWith("sparkCloudRestoreScreen")
  })

  it("navigates to the manual restore screen when the manual button is pressed", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <RestoreMethodScreen />
      </ContextForScreen>,
    )

    fireEvent.press(
      getByTestId(`secondary-${LL.BackupScreen.BackupMethod.manualBackup()}`),
    )
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRestorePhrase", {
      step: 1,
    })
  })

  describe("password manager restore", () => {
    const passwordManagerTestId = () =>
      `secondary-${LL.BackupScreen.BackupMethod.passwordManager()}`

    it("restores the wallet on successful read", async () => {
      mockRead.mockResolvedValue({
        success: true,
        walletIdentifier: "pubkey-1",
        mnemonic: "word1 word2 word3",
      })
      mockRestore.mockResolvedValue(undefined)

      const { getByTestId } = render(
        <ContextForScreen>
          <RestoreMethodScreen />
        </ContextForScreen>,
      )

      await act(async () => {
        fireEvent.press(getByTestId(passwordManagerTestId()))
      })

      expect(mockRestore).toHaveBeenCalledWith("word1 word2 word3")
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("stays silent when the user cancels", async () => {
      mockRead.mockResolvedValue({ success: false, error: "user-cancelled" })

      const { getByTestId } = render(
        <ContextForScreen>
          <RestoreMethodScreen />
        </ContextForScreen>,
      )

      await act(async () => {
        fireEvent.press(getByTestId(passwordManagerTestId()))
      })

      expect(mockRestore).not.toHaveBeenCalled()
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("shows the noBackupFound toast when no provider is configured", async () => {
      mockRead.mockResolvedValue({ success: false, error: "no-provider" })

      const { getByTestId } = render(
        <ContextForScreen>
          <RestoreMethodScreen />
        </ContextForScreen>,
      )

      await act(async () => {
        fireEvent.press(getByTestId(passwordManagerTestId()))
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: LL.RestoreScreen.noBackupFound() }),
      )
      expect(mockRestore).not.toHaveBeenCalled()
    })

    it("shows the noBackupFound toast on unsupported platform", async () => {
      mockRead.mockResolvedValue({ success: false, error: "unsupported" })

      const { getByTestId } = render(
        <ContextForScreen>
          <RestoreMethodScreen />
        </ContextForScreen>,
      )

      await act(async () => {
        fireEvent.press(getByTestId(passwordManagerTestId()))
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: LL.RestoreScreen.noBackupFound() }),
      )
    })

    it("shows the restoreFailed toast on unknown errors", async () => {
      mockRead.mockResolvedValue({ success: false, error: "unknown" })

      const { getByTestId } = render(
        <ContextForScreen>
          <RestoreMethodScreen />
        </ContextForScreen>,
      )

      await act(async () => {
        fireEvent.press(getByTestId(passwordManagerTestId()))
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: LL.RestoreScreen.restoreFailed() }),
      )
      expect(mockRestore).not.toHaveBeenCalled()
    })
  })
})
