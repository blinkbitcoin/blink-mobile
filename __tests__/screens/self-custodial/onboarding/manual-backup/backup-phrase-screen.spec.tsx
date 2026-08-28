import React from "react"
import { render, fireEvent, waitFor } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { BackupPhraseScreen } from "@app/screens/self-custodial/onboarding/manual-backup/backup-phrase-screen"
import { ContextForScreen } from "../../../helper"
import { flushEffects } from "../../../../helpers/flush-effects"

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
let mockStep: unknown = 1
let mockHasParams = true
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
  useRoute: () => ({ params: mockHasParams ? { step: mockStep } : undefined }),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
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

const mockCopyToClipboard = jest.fn()
let mockCountdown = { remainingSeconds: 0, isExpired: true }
jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
  useCountdown: () => mockCountdown,
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    sparkCompatibleWalletsUrl: "https://example.com",
  }),
}))

jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () =>
    "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain",
}))

jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  default: { open: jest.fn(() => Promise.resolve()) },
}))

const mockOpenExternalUrl = jest.fn()
jest.mock("@app/utils/external", () => ({
  ...jest.requireActual("@app/utils/external"),
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

jest.mock("@app/screens/settings-screen/group", () => {
  const { View } = jest.requireActual("react-native")
  return {
    SettingsGroup: ({ items }: { items: (() => React.ReactNode)[] }) => (
      <View>
        {items.map((Item, idx) => (
          <View key={idx}>{Item()}</View>
        ))}
      </View>
    ),
  }
})

loadLocale("en")
const LL = i18nObject("en")

describe("BackupPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStep = 1
    mockHasParams = true
    mockCountdown = { remainingSeconds: 0, isExpired: true }
    mockLeaseReady = Promise.resolve()
  })

  /** The screen shows the mnemonic and a header Copy action; until the screen
   *  guard is actually on, none of that may exist — a pending or failed
   *  registration must not paint the seed words. */
  describe("screen security gate", () => {
    it("shows no seed words while registration is pending, and the words once it resolves", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      const { queryByText, findByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(queryByText("youth")).toBeNull()
      expect(mockSetOptions).not.toHaveBeenCalled()

      registration.resolve(undefined)
      expect(await findByText("youth")).toBeTruthy()
    })

    it("keeps the seed words unmounted when registration is exhausted", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      const { queryByText, findByTestId } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()
      registration.reject(new Error("native failure"))

      expect(await findByTestId("screen-security-retry")).toBeTruthy()
      expect(queryByText("youth")).toBeNull()
      expect(mockSetOptions).not.toHaveBeenCalled()
    })
  })

  /** Deep links and navigation-state rehydration can deliver missing or malformed params;
   *  the screen falls back to step 1 (the first six words) instead of throwing into the
   *  app-wide ErrorBoundary, which replaces the whole navigation tree (#4070). */
  describe("route param guards", () => {
    it("falls back to step 1 when the route delivers no params", async () => {
      mockHasParams = false

      const { getByText, queryByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      await waitFor(() => expect(getByText("youth")).toBeTruthy())
      expect(queryByText("ritual")).toBeNull()
      expect(mockReportError).toHaveBeenCalledTimes(1)
      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({
          dedupKey: "backup-phrase-params-missing",
          alwaysRecord: true,
        }),
      )
    })

    it("falls back to step 1 when the route delivers an out-of-range step", async () => {
      mockStep = 7

      const { getByText, queryByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      await waitFor(() => expect(getByText("youth")).toBeTruthy())
      expect(queryByText("ritual")).toBeNull()
      expect(mockReportError).toHaveBeenCalledTimes(1)
    })

    it("does not report valid params", async () => {
      render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReportError).not.toHaveBeenCalled()
    })

    /** The report must not wait for the screen guard: on a device where registration
     *  keeps failing the gated content never mounts, and the signal would be lost. */
    it("reports malformed params even while the guard is still pending", async () => {
      mockHasParams = false
      mockLeaseReady = new Promise(() => {}) // the guard never activates

      render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReportError).toHaveBeenCalledTimes(1)
      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({ dedupKey: "backup-phrase-params-missing" }),
      )
    })
  })

  describe("step 1", () => {
    it("renders first 6 words", async () => {
      const { getByText, queryByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      await waitFor(() => expect(getByText("youth")).toBeTruthy())
      expect(getByText("execute")).toBeTruthy()
      expect(queryByText("ritual")).toBeNull()
    })

    it("shows Continue button when timer expired", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(getByText(LL.BackupScreen.ManualBackup.Phrase.continueButton())).toBeTruthy()
    })

    it("navigates to step 2 on continue press", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.continueButton()))
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupPhrase", { step: 2 })
    })

    it("shows countdown in button when timer is active", async () => {
      mockCountdown = { remainingSeconds: 5, isExpired: false }

      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(
        getByText(new RegExp(LL.BackupScreen.ManualBackup.Phrase.saveItNow())),
      ).toBeTruthy()
    })

    it("disables button during countdown", async () => {
      mockCountdown = { remainingSeconds: 5, isExpired: false }

      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      fireEvent.press(
        getByText(new RegExp(LL.BackupScreen.ManualBackup.Phrase.saveItNow())),
      )
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe("step 2", () => {
    beforeEach(() => {
      mockStep = 2
    })

    it("renders last 6 words", async () => {
      const { getByText, queryByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      await waitFor(() => expect(getByText("ritual")).toBeTruthy())
      expect(getByText("captain")).toBeTruthy()
      expect(queryByText("youth")).toBeNull()
    })

    it("shows I have saved it button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(getByText(LL.BackupScreen.ManualBackup.Phrase.savedConfirm())).toBeTruthy()
    })

    it("navigates to confirm screen on button press", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      await waitFor(() => expect(getByText("ritual")).toBeTruthy())
      fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.savedConfirm()))
      expect(mockNavigate).toHaveBeenCalledWith(
        "selfCustodialBackupPhraseConfirm",
        expect.objectContaining({
          challenges: expect.arrayContaining([
            expect.objectContaining({
              index: expect.any(Number),
              word: expect.any(String),
            }),
          ]),
        }),
      )
    })
  })

  describe("shared", () => {
    it("renders copy button in the header", async () => {
      render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      const { getByText } = renderHeaderRight()
      expect(getByText(LL.BackupScreen.ManualBackup.Phrase.copy())).toBeTruthy()
    })

    it("calls copyToClipboard when copy button is pressed", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      await waitFor(() => expect(getByText("youth")).toBeTruthy())
      const { getByText: getHeaderText } = renderHeaderRight()
      fireEvent.press(getHeaderText(LL.BackupScreen.ManualBackup.Phrase.copy()))
      expect(mockCopyToClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("youth"),
          message: LL.BackupScreen.ManualBackup.Phrase.copiedToast(),
        }),
      )
    })

    it("announces the Copy button by its visible label, not the test id", async () => {
      render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      const { getByTestId } = renderHeaderRight()
      const button = getByTestId("backup-phrase-copy")
      // `testProps` sets accessibilityLabel to the test id; the explicit
      // accessibilityLabel after the spread must win.
      expect(button.props.accessibilityLabel).toBe(
        LL.BackupScreen.ManualBackup.Phrase.copy(),
      )
      expect(button.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 })
    })

    it("renders spark compatible link", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(
        getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()),
      ).toBeTruthy()
    })

    it("opens the spark-compatible link from the info banner", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      fireEvent.press(
        getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()),
      )

      expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://example.com")
    })

    it("renders the do-not-share warning card", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <BackupPhraseScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(
        getByText(LL.BackupScreen.ManualBackup.Phrase.doNotShareWarning()),
      ).toBeTruthy()
    })
  })
})
