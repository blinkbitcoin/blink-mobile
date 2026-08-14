import React from "react"

import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ViewBackupPhraseScreen } from "@app/screens/self-custodial/onboarding/manual-backup/view-backup-phrase-screen"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { ContextForScreen } from "../../../helper"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
  }),
}))

const mockIsSensorAvailable = jest.fn()
const mockAuthenticate = jest.fn()
jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: (...args: unknown[]) => mockIsSensorAvailable(...args),
    authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  },
}))

const mockReleaseScreenSecurity = jest.fn(() => Promise.resolve())
let mockLeaseReady: Promise<void> = Promise.resolve()
jest.mock("@app/utils/screen-security", () => ({
  acquireScreenSecurity: () => ({
    ready: mockLeaseReady,
    release: mockReleaseScreenSecurity,
  }),
}))

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: Error) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const renderHeaderRight = () => {
  const calls = mockSetOptions.mock.calls
  const lastOptions = calls[calls.length - 1]?.[0]
  if (!lastOptions?.headerRight) throw new Error("headerRight was not set")
  return render(<ContextForScreen>{lastOptions.headerRight()}</ContextForScreen>)
}

// `headerRightNoGlass` writes `headerRight` for Android and
// `unstable_headerRightItems` for iOS, so a header is only truly absent when
// neither key was ever handed a renderer.
const headerRightWasInstalled = () =>
  mockSetOptions.mock.calls.some(
    ([options]) => options?.headerRight || options?.unstable_headerRightItems,
  )

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ sparkCompatibleWalletsUrl: "https://spark.example" }),
}))

jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () =>
    "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain",
}))

const mockOpenExternalUrl = jest.fn()
jest.mock("@app/utils/external", () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("ViewBackupPhraseScreen", () => {
  let mockReadIsBiometricsEnabled: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // biometrics disabled by default: the gate passes without prompting
    mockReadIsBiometricsEnabled = jest
      .spyOn(KeyStoreWrapper, "readIsBiometricsEnabled")
      .mockResolvedValue({ status: "no" })
    mockIsSensorAvailable.mockResolvedValue(true)
    mockLeaseReady = Promise.resolve()
  })

  /** Until the screen guard is actually on, neither the words nor the header Copy
   *  action may exist — a pending or failed registration must not paint the
   *  mnemonic. */
  describe("screen security gate", () => {
    it("shows no words and installs no Copy action while registration is pending", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      const { queryByText } = render(
        <ContextForScreen>
          <ViewBackupPhraseScreen />
        </ContextForScreen>,
      )
      await act(async () => {})

      expect(queryByText("youth")).toBeNull()
      expect(headerRightWasInstalled()).toBe(false)

      registration.resolve(undefined)
      await waitFor(() => expect(queryByText("youth")).toBeTruthy())
      expect(headerRightWasInstalled()).toBe(true)
    })

    it("keeps the words unmounted after registration fails", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      const { queryByText, findByTestId } = render(
        <ContextForScreen>
          <ViewBackupPhraseScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      registration.reject(new Error("native failure"))

      expect(await findByTestId("screen-security-retry")).toBeTruthy()
      expect(queryByText("youth")).toBeNull()
      expect(headerRightWasInstalled()).toBe(false)
    })
  })

  it("renders all 12 words once the mnemonic loads", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(getByText("captain")).toBeTruthy()
    expect(getByText("execute")).toBeTruthy()
    expect(getByText("genuine")).toBeTruthy()
  })

  it("shows the Copy button in the header and the spark-compatible wallet link", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(
      getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()),
    ).toBeTruthy()

    const { getByText: getHeaderText } = renderHeaderRight()
    expect(getHeaderText(LL.BackupScreen.ManualBackup.Phrase.copy())).toBeTruthy()
  })

  it("announces the Copy button by its visible label, not the test id", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())

    const { getByTestId } = renderHeaderRight()
    const button = getByTestId("backup-phrase-copy")
    // `testProps` sets accessibilityLabel to the test id; the explicit
    // accessibilityLabel after the spread must win.
    expect(button.props.accessibilityLabel).toBe(
      LL.BackupScreen.ManualBackup.Phrase.copy(),
    )
    expect(button.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 })
  })

  it("renders the do-not-share warning card", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(
      getByText(LL.BackupScreen.ManualBackup.Phrase.doNotShareWarning()),
    ).toBeTruthy()
  })

  it("copies the full mnemonic to the clipboard", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    const { getByText: getHeaderText } = renderHeaderRight()
    fireEvent.press(getHeaderText(LL.BackupScreen.ManualBackup.Phrase.copy()))

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("captain"),
        message: LL.BackupScreen.ManualBackup.Phrase.copiedToast(),
      }),
    )
  })

  it("opens the spark-compatible link from the info banner", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()))

    expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://spark.example")
  })

  it("renders the Test your backup CTA", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(getByText(LL.BackupScreen.ManualBackup.Phrase.testBackup())).toBeTruthy()
  })

  it("navigates to confirm with challenges and the dynamic success message", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.testBackup()))

    expect(mockNavigate).toHaveBeenCalledWith(
      "selfCustodialBackupPhraseConfirm",
      expect.objectContaining({
        challenges: expect.arrayContaining([
          expect.objectContaining({
            index: expect.any(Number),
            word: expect.any(String),
          }),
        ]),
        successMessage: LL.BackupScreen.ManualBackup.Success.testSuccess(),
      }),
    )
  })

  it("does not prompt for biometrics when the setting is disabled", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(mockAuthenticate).not.toHaveBeenCalled()
  })

  it("shows the phrase after successful biometric auth when the setting is enabled", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue({ status: "yes" })
    mockAuthenticate.mockImplementation((_desc: string, onSuccess: () => void) => {
      onSuccess()
    })

    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(mockAuthenticate).toHaveBeenCalledWith(
      LL.BackupScreen.ManualBackup.Phrase.authDescription(),
      expect.any(Function),
      expect.any(Function),
    )
  })

  it("goes back without showing the phrase when biometric auth fails", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue({ status: "yes" })
    mockAuthenticate.mockImplementation(
      (_desc: string, _onSuccess: () => void, onFail: () => void) => {
        onFail()
      },
    )

    const { queryByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1))
    expect(queryByText("youth")).toBeNull()
  })

  it("does not show the phrase while biometric auth is pending", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue({ status: "yes" })
    mockAuthenticate.mockImplementation(() => {
      // user has not responded to the prompt yet
    })

    const { queryByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1))
    expect(queryByText("youth")).toBeNull()
  })

  it("does not install the header Copy button while biometric auth is pending", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue({ status: "yes" })
    mockAuthenticate.mockImplementation(() => {
      // user has not responded to the prompt yet
    })

    render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1))

    // The header is installed from a useLayoutEffect that sits above the
    // `!authenticated` early return, so an ungated version would mount a Copy
    // button that hands out the whole mnemonic before the prompt is answered.
    expect(headerRightWasInstalled()).toBe(false)
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
  })

  it("does not install the header Copy button when biometric auth fails", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue({ status: "yes" })
    mockAuthenticate.mockImplementation(
      (_desc: string, _onSuccess: () => void, onFail: () => void) => {
        onFail()
      },
    )

    render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1))
    expect(headerRightWasInstalled()).toBe(false)
  })

  it("installs the header Copy button once biometric auth succeeds", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue({ status: "yes" })
    mockAuthenticate.mockImplementation((_desc: string, onSuccess: () => void) => {
      onSuccess()
    })

    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())

    const { getByText: getHeaderText } = renderHeaderRight()
    fireEvent.press(getHeaderText(LL.BackupScreen.ManualBackup.Phrase.copy()))

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("captain"),
      }),
    )
  })
})
