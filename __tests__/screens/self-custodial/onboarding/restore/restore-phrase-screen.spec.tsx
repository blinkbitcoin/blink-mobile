import React from "react"
import { render } from "@testing-library/react-native"

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

type MnemonicWordInputProps = {
  index: number
  value: string
  placeholder: string
  correct?: boolean
  wrong?: boolean
  testID?: string
}
const mockMnemonicWordInput = jest.fn<null, [MnemonicWordInputProps]>(() => null)
jest.mock("@app/components/mnemonic-word-input", () => {
  const ReactImpl = jest.requireActual("react")
  const Mock = ReactImpl.forwardRef(
    (props: MnemonicWordInputProps, _ref: React.Ref<unknown>) =>
      mockMnemonicWordInput(props),
  )
  Mock.displayName = "MockMnemonicWordInput"
  return { MnemonicWordInput: Mock }
})

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
})
