import React from "react"
import { render } from "@testing-library/react-native"

import { SparkRestorePhraseScreen } from "@app/screens/spark-onboarding/restore/restore-phrase-screen"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../helper"

const mockUseRestorePhrase = jest.fn()
jest.mock("@app/screens/spark-onboarding/restore/hooks/use-restore-phrase", () => ({
  useRestorePhrase: () => mockUseRestorePhrase(),
  RestoreStatus: { Idle: "idle", Restoring: "restoring", Error: "error" },
}))

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
  useRoute: () => ({ params: { step: 2, words: Array(12).fill("") } }),
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
      <SparkRestorePhraseScreen />
    </ContextForScreen>,
  )

describe("SparkRestorePhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRestorePhrase.mockReturnValue(defaultHookReturn)
  })

  it("renders the inline invalidMnemonic message when step 2 is fully filled but invalid", () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      allFilled: true,
      isValid: false,
    })

    const { getByText } = renderScreen()

    expect(getByText(LL.RestoreScreen.invalidMnemonic())).toBeTruthy()
  })

  it("does not render the inline invalidMnemonic message while still typing", () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      allFilled: false,
      isValid: false,
    })

    const { queryByText } = renderScreen()

    expect(queryByText(LL.RestoreScreen.invalidMnemonic())).toBeNull()
  })

  it("propagates wrong=true to MnemonicWordInput when showError is active", () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      allFilled: true,
      isValid: false,
    })

    renderScreen()

    expect(mockMnemonicWordInput).toHaveBeenCalled()
    const lastCall =
      mockMnemonicWordInput.mock.calls[mockMnemonicWordInput.mock.calls.length - 1]
    expect(lastCall[0].wrong).toBe(true)
  })

  it("propagates wrong=false to MnemonicWordInput when no error is active", () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      allFilled: false,
      isValid: false,
      validationError: null,
    })

    renderScreen()

    const lastCall =
      mockMnemonicWordInput.mock.calls[mockMnemonicWordInput.mock.calls.length - 1]
    expect(lastCall[0].wrong).toBe(false)
  })

  it("renders the restoring spinner while status is Restoring", () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      status: "restoring",
    })

    const { getByText } = renderScreen()

    expect(getByText(LL.RestoreScreen.restoring())).toBeTruthy()
  })

  it("renders the error screen with retry CTA when status is Error", () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      status: "error",
    })

    const { getByText } = renderScreen()

    expect(getByText(LL.RestoreScreen.restoreFailed())).toBeTruthy()
    expect(getByText(LL.common.tryAgain())).toBeTruthy()
  })

  it("renders a custom validationError text when set", () => {
    mockUseRestorePhrase.mockReturnValue({
      ...defaultHookReturn,
      validationError: "Custom validation error",
    })

    const { getByText } = renderScreen()

    expect(getByText("Custom validation error")).toBeTruthy()
  })
})
