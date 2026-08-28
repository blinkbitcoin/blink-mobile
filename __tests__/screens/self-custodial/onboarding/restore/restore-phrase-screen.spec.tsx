import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { RestorePhraseScreen } from "@app/screens/self-custodial/onboarding/restore/restore-phrase-screen"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../../../helper"
import { flushEffects } from "../../../../helpers/flush-effects"

const mockUseRestorePhrase = jest.fn()
jest.mock(
  "@app/screens/self-custodial/onboarding/restore/hooks/use-restore-phrase",
  () => ({
    useRestorePhrase: (args: unknown) => mockUseRestorePhrase(args),
    RestoreStatus: { Idle: "idle", Restoring: "restoring", Error: "error" },
  }),
)

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
let mockRouteParams: unknown
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
  useRoute: () => ({ params: mockRouteParams }),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

const mockReleaseScreenSecurity = jest.fn(() => Promise.resolve())
const mockAcquireScreenSecurity = jest.fn()
jest.mock("@app/utils/screen-security", () => ({
  acquireScreenSecurity: () => mockAcquireScreenSecurity(),
}))

type MnemonicWordInputProps = {
  index: number
  value: string
  placeholder: string
  correct?: boolean
  wrong?: boolean
  testID?: string
  onChangeText?: (text: string) => void
  onFocus?: () => void
}
const mockMnemonicWordInput = jest.fn<null, [MnemonicWordInputProps]>(() => null)
const mockInputFocus = jest.fn()
jest.mock("@app/components/mnemonic-word-input", () => {
  const ReactImpl = jest.requireActual("react")
  const Mock = ReactImpl.forwardRef(
    (props: MnemonicWordInputProps, ref: React.Ref<unknown>) => {
      ReactImpl.useImperativeHandle(ref, () => ({
        focus: () => mockInputFocus(props.index),
      }))
      return mockMnemonicWordInput(props)
    },
  )
  Mock.displayName = "MockMnemonicWordInput"
  return { MnemonicWordInput: Mock }
})

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

const lastSetOptions = () => {
  const calls = mockSetOptions.mock.calls
  return calls[calls.length - 1]?.[0]
}

loadLocale("en")
const LL = i18nObject("en")

/** Step 2 is only usable when the first six words survived the hand-off from step 1;
 *  the last six are what the user is about to type. */
const validStep2Words = [
  ...["abandon", "ability", "able", "about", "above", "absent"],
  ...Array(6).fill(""),
]

const defaultHookReturn = {
  stepWords: Array(6).fill(""),
  offset: 6,
  setActiveIndex: jest.fn(),
  updateWord: jest.fn(),
  handlePaste: jest.fn(() => false),
  handlePasteFromClipboard: jest.fn(),
  suggestions: [],
  selectSuggestion: jest.fn(),
  stepFilled: false,
  allFilled: false,
  isValid: false,
  validationError: null as string | null,
  status: "idle",
  isStep1: false,
  handleContinue: jest.fn(),
  handleRestore: jest.fn(),
  focusRequest: null as number | null,
  clearFocusRequest: jest.fn(),
  words: Array(12).fill(""),
  activeIndex: 0,
}

const renderScreen = () =>
  render(
    <ContextForScreen>
      <RestorePhraseScreen />
    </ContextForScreen>,
  )

describe("RestorePhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAcquireScreenSecurity.mockReturnValue({
      ready: Promise.resolve(),
      release: mockReleaseScreenSecurity,
    })
    mockRouteParams = { step: 2, words: [...validStep2Words] }
    mockUseRestorePhrase.mockReturnValue(defaultHookReturn)
  })

  /** Deep links and navigation-state rehydration can deliver missing or malformed params;
   *  the screen falls back to step 1 (where a restore starts) instead of throwing into the
   *  app-wide ErrorBoundary, which replaces the whole navigation tree (#4070). */
  describe("route param guards", () => {
    it("falls back to step 1 when the route delivers no params", async () => {
      mockRouteParams = undefined

      const { getByText } = renderScreen()
      await flushEffects()

      expect(getByText(LL.RestoreScreen.phraseSubtitleStep1())).toBeTruthy()
      expect(mockUseRestorePhrase).toHaveBeenCalledWith({
        step: 1,
        initialWords: undefined,
      })
    })

    it("falls back to step 1 when the route delivers an out-of-range step", async () => {
      mockRouteParams = { step: 5 }

      const { getByText } = renderScreen()
      await flushEffects()

      expect(getByText(LL.RestoreScreen.phraseSubtitleStep1())).toBeTruthy()
    })

    /** Step 2 without usable words is a dead end — inputs 7-12 rendered over a phrase
     *  whose first six words were never entered — so it is invalid params, not a
     *  degraded-but-usable state (#4088 review, I1). */
    it("falls back to step 1 and reports when step 2 arrives with malformed words", async () => {
      mockRouteParams = { step: 2, words: "not-an-array" }

      const { getByText } = renderScreen()
      await flushEffects()

      expect(getByText(LL.RestoreScreen.phraseSubtitleStep1())).toBeTruthy()
      expect(mockUseRestorePhrase).toHaveBeenCalledWith({
        step: 1,
        initialWords: undefined,
      })
      expect(mockReportError).toHaveBeenCalledTimes(1)
      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({
          dedupKey: "restore-phrase-params-missing",
          alwaysRecord: true,
        }),
      )
    })

    it("falls back to step 1 and reports when step 2 arrives with a truncated words array", async () => {
      mockRouteParams = { step: 2, words: ["abandon", "ability"] }

      renderScreen()
      await flushEffects()

      expect(mockUseRestorePhrase).toHaveBeenCalledWith({
        step: 1,
        initialWords: undefined,
      })
      expect(mockReportError).toHaveBeenCalledTimes(1)
    })

    it("falls back to step 1 and reports when step 2 arrives with its leading words empty", async () => {
      mockRouteParams = { step: 2, words: Array(12).fill("") }

      renderScreen()
      await flushEffects()

      expect(mockUseRestorePhrase).toHaveBeenCalledWith({
        step: 1,
        initialWords: undefined,
      })
      expect(mockReportError).toHaveBeenCalledTimes(1)
    })

    it("stays on step 2 and seeds the words when they are usable", async () => {
      renderScreen()
      await flushEffects()

      expect(mockUseRestorePhrase).toHaveBeenCalledWith({
        step: 2,
        initialWords: validStep2Words,
      })
      expect(mockReportError).not.toHaveBeenCalled()
    })

    it("reports the malformed params once", async () => {
      mockRouteParams = undefined

      renderScreen()
      await flushEffects()

      expect(mockReportError).toHaveBeenCalledTimes(1)
      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({
          dedupKey: "restore-phrase-params-missing",
          alwaysRecord: true,
        }),
      )
    })

    it("does not report valid params", async () => {
      renderScreen()
      await flushEffects()

      expect(mockReportError).not.toHaveBeenCalled()
    })
  })

  it("renders the inline invalidMnemonic message when step 2 is fully filled but invalid", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      allFilled: true,
      isValid: false,
    })

    const { getByText } = renderScreen()
    await flushEffects()

    expect(getByText(LL.RestoreScreen.invalidMnemonic())).toBeTruthy()
  })

  it("does not render the inline invalidMnemonic message while still typing", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      allFilled: false,
      isValid: false,
    })

    const { queryByText } = renderScreen()
    await flushEffects()

    expect(queryByText(LL.RestoreScreen.invalidMnemonic())).toBeNull()
  })

  it("propagates wrong=true to MnemonicWordInput when showError is active", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      allFilled: true,
      isValid: false,
    })

    renderScreen()
    await flushEffects()

    expect(mockMnemonicWordInput).toHaveBeenCalled()
    const lastCall =
      mockMnemonicWordInput.mock.calls[mockMnemonicWordInput.mock.calls.length - 1]
    expect(lastCall[0].wrong).toBe(true)
  })

  it("propagates wrong=false to MnemonicWordInput when no error is active", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      allFilled: false,
      isValid: false,
      validationError: null,
    })

    renderScreen()
    await flushEffects()

    const lastCall =
      mockMnemonicWordInput.mock.calls[mockMnemonicWordInput.mock.calls.length - 1]
    expect(lastCall[0].wrong).toBe(false)
  })

  it("renders the restoring spinner while status is Restoring", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      status: "restoring",
    })

    const { getByText } = renderScreen()
    await flushEffects()

    expect(getByText(LL.RestoreScreen.restoring())).toBeTruthy()
  })

  it("renders the error screen with retry CTA when status is Error", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      status: "error",
    })

    const { getByText } = renderScreen()
    await flushEffects()

    expect(getByText(LL.RestoreScreen.restoreFailed())).toBeTruthy()
    expect(getByText(LL.common.tryAgain())).toBeTruthy()
  })

  it("renders a custom validationError text when set", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      validationError: "Custom validation error",
    })

    const { getByText } = renderScreen()
    await flushEffects()

    expect(getByText("Custom validation error")).toBeTruthy()
  })

  it("focuses the requested input and clears the request", async () => {
    const clearFocusRequest = jest.fn()
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      focusRequest: 7,
      clearFocusRequest,
    })

    renderScreen()
    await flushEffects()

    expect(mockInputFocus).toHaveBeenCalledWith(7)
    expect(clearFocusRequest).toHaveBeenCalledTimes(1)
  })

  it("wires the header paste button to the clipboard handler on step 1", async () => {
    mockRouteParams = { step: 1 }
    const handlePasteFromClipboard = jest.fn()
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: true,
      offset: 0,
      handlePasteFromClipboard,
    })

    renderScreen()
    await flushEffects()

    const { headerRight } = mockSetOptions.mock.calls[0][0]
    const pasteButton = headerRight()
    pasteButton.props.onPress()

    expect(handlePasteFromClipboard).toHaveBeenCalledTimes(1)
  })

  it("marks the active input on focus", async () => {
    const setActiveIndex = jest.fn()
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      setActiveIndex,
    })

    renderScreen()
    await flushEffects()

    mockMnemonicWordInput.mock.calls[0][0].onFocus?.()

    expect(setActiveIndex).toHaveBeenCalledWith(6)
  })

  it("routes typed text to updateWord on non-first inputs", async () => {
    const updateWord = jest.fn()
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      updateWord,
    })

    renderScreen()
    await flushEffects()

    mockMnemonicWordInput.mock.calls[0][0].onChangeText?.("apple")

    expect(updateWord).toHaveBeenCalledWith(6, "apple")
  })

  it("lets an accepted paste on the first input swallow the change", async () => {
    mockRouteParams = { step: 1 }
    const handlePaste = jest.fn(() => true)
    const updateWord = jest.fn()
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: true,
      offset: 0,
      handlePaste,
      updateWord,
    })

    renderScreen()
    await flushEffects()

    mockMnemonicWordInput.mock.calls[0][0].onChangeText?.("abandon ability able")

    expect(handlePaste).toHaveBeenCalledWith("abandon ability able")
    expect(updateWord).not.toHaveBeenCalled()
  })

  it("falls through to updateWord when the first input's text is not a paste", async () => {
    mockRouteParams = { step: 1 }
    const handlePaste = jest.fn(() => false)
    const updateWord = jest.fn()
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: true,
      offset: 0,
      handlePaste,
      updateWord,
    })

    renderScreen()
    await flushEffects()

    mockMnemonicWordInput.mock.calls[0][0].onChangeText?.("aba")

    expect(updateWord).toHaveBeenCalledWith(0, "aba")
  })

  it("renders the recognize-phrase warning card on step 1", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: true,
    })

    const { getByText } = renderScreen()
    await flushEffects()

    expect(getByText(LL.RestoreScreen.recognizePhraseTitle())).toBeTruthy()
    expect(getByText(LL.RestoreScreen.recognizePhraseBody())).toBeTruthy()
  })

  it("does not render the recognize-phrase warning card on step 2", () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: false,
    })

    const { queryByText } = renderScreen()

    expect(queryByText(LL.RestoreScreen.recognizePhraseTitle())).toBeNull()
  })

  it("installs the header Paste button on step 1 and wires it to the clipboard", async () => {
    const handlePasteFromClipboard = jest.fn()
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: true,
      handlePasteFromClipboard,
    })

    renderScreen()
    await flushEffects()

    const { getByText } = renderHeaderRight()
    fireEvent.press(getByText(LL.RestoreScreen.paste()))

    expect(handlePasteFromClipboard).toHaveBeenCalledTimes(1)
  })

  it("announces the Paste button by its visible label, not the test id", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: true,
    })

    renderScreen()
    await flushEffects()

    const { getByTestId } = renderHeaderRight()
    const button = getByTestId("restore-paste-button")
    expect(button.props.accessibilityLabel).toBe(LL.RestoreScreen.paste())
    expect(button.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 })
  })

  it("clears the header Paste button when step 1 advances to step 2", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: true,
    })

    const { rerender } = renderScreen()
    await flushEffects()
    expect(headerRightWasInstalled()).toBe(true)

    // Step 1 -> step 2 updates params on the same mounted screen, so the header
    // must be cleared by the effect re-run rather than by an unmount.
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: false,
    })
    rerender(
      <ContextForScreen>
        <RestorePhraseScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(lastSetOptions()).toEqual({
      headerRight: undefined,
      // eslint-disable-next-line camelcase -- name dictated by @react-navigation/native-stack
      unstable_headerRightItems: undefined,
    })
  })

  it("never installs the header Paste button when rendered on step 2", async () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      isStep1: false,
    })

    renderScreen()
    await flushEffects()

    expect(headerRightWasInstalled()).toBe(false)
    expect(lastSetOptions()).toEqual({
      headerRight: undefined,
      // eslint-disable-next-line camelcase -- name dictated by @react-navigation/native-stack
      unstable_headerRightItems: undefined,
    })
  })

  /** The screen shows a funded wallet's mnemonic, so it must carry the same
   *  screenshot/screen-recording protection as the backup-creation screen. */
  describe("screen security", () => {
    it("acquires screen protection on mount", async () => {
      renderScreen()
      await flushEffects()

      expect(mockAcquireScreenSecurity).toHaveBeenCalledTimes(1)
    })

    it("keeps screen protection active on the restoring and error states", async () => {
      for (const status of ["restoring", "error"]) {
        jest.clearAllMocks()
        mockUseRestorePhrase.mockReturnValue({ ...defaultHookReturn, status })

        renderScreen()
        await flushEffects()

        expect(mockAcquireScreenSecurity).toHaveBeenCalledTimes(1)
      }
    })

    it("releases screen protection on unmount", async () => {
      const { unmount } = renderScreen()
      await flushEffects()

      unmount()

      expect(mockReleaseScreenSecurity).toHaveBeenCalledTimes(1)
    })

    /** Restore is input-only — the user types a phrase they already hold — so the
     *  gate fails open: a device where registration never succeeds must not lock
     *  the user out of their funds. */
    it("still renders the inputs when screen protection cannot be acquired", async () => {
      mockAcquireScreenSecurity.mockReturnValue({
        ready: Promise.reject(new Error("native failure")),
        release: mockReleaseScreenSecurity,
      })

      renderScreen()
      await flushEffects()

      expect(mockUseRestorePhrase).toHaveBeenCalled()
      expect(mockMnemonicWordInput).toHaveBeenCalled()
    })
  })

  /** Both regressions below come from the same place: the gate unmounts its subtree
   *  whenever the guard drops, and a theme flip re-registers the guard with the new
   *  mask colour. What the user typed, and the header action the content installed,
   *  must both survive that. */
  describe("surviving a gate re-activation", () => {
    it("keeps the phrase state above the gate, so a pending guard cannot wipe it", async () => {
      // Never-settling lease: the gate stays on its spinner and mounts no content.
      mockAcquireScreenSecurity.mockReturnValue({
        ready: new Promise<void>(() => {}),
        release: mockReleaseScreenSecurity,
      })

      renderScreen()
      await flushEffects()

      /** The hook holding the typed words runs even with the content unmounted.
       *  Held inside the gate it would be torn down and re-created on every
       *  re-activation, losing every word the user had entered. */
      expect(mockUseRestorePhrase).toHaveBeenCalled()
    })
  })
})
