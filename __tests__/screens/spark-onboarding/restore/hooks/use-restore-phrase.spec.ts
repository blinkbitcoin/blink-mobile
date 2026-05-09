import { renderHook, act } from "@testing-library/react-native"

import { useRestorePhrase } from "@app/screens/spark-onboarding/restore/hooks/use-restore-phrase"
import { PhraseStep } from "@app/navigation/stack-param-lists"

const mockNavigate = jest.fn()
const mockRestore = jest.fn()
const mockGetString = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@react-native-clipboard/clipboard", () => ({
  getString: () => mockGetString(),
}))

jest.mock("bip39", () => ({
  validateMnemonic: (m: string) => m.split(" ").length === 12 && m.startsWith("valid"),
  wordlists: { english: [] },
}))

const mockUpdateWord = jest.fn()
const mockHandlePaste = jest.fn()

let mockBip39State = {
  words: Array(12).fill(""),
  stepWords: Array(6).fill(""),
  offset: 0,
  activeIndex: 0,
  setActiveIndex: jest.fn(),
  updateWord: mockUpdateWord,
  handlePaste: mockHandlePaste,
  suggestions: [],
  selectSuggestion: jest.fn(),
  stepFilled: false,
  allFilled: false,
  focusRequest: null as number | null,
  clearFocusRequest: jest.fn(),
}

jest.mock("@app/hooks/use-bip39-input", () => ({
  useBip39Input: () => mockBip39State,
}))

jest.mock("@app/screens/spark-onboarding/restore/hooks/use-restore-wallet", () => ({
  RestoreWalletStatus: { Idle: "idle", Restoring: "restoring", Error: "error" },
  useRestoreWallet: () => ({
    status: "idle",
    restore: mockRestore,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      RestoreScreen: {
        invalidMnemonic: () => "Invalid mnemonic",
      },
    },
  }),
}))

describe("useRestorePhrase", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBip39State = {
      words: Array(12).fill(""),
      stepWords: Array(6).fill(""),
      offset: 0,
      activeIndex: 0,
      setActiveIndex: jest.fn(),
      updateWord: mockUpdateWord,
      handlePaste: mockHandlePaste,
      suggestions: [],
      selectSuggestion: jest.fn(),
      stepFilled: false,
      allFilled: false,
      focusRequest: null as number | null,
      clearFocusRequest: jest.fn(),
    }
  })

  it("returns initial state", () => {
    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    expect(result.current.validationError).toBeNull()
    expect(result.current.status).toBe("idle")
    expect(result.current.isStep1).toBe(true)
  })

  it("navigates to step 2 on continue from step 1", () => {
    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    act(() => {
      result.current.handleContinue()
    })

    expect(mockNavigate).toHaveBeenCalledWith("sparkRestorePhraseScreen", {
      step: PhraseStep.Second,
      words: Array(12).fill(""),
    })
  })

  it("pastes from clipboard", async () => {
    mockGetString.mockResolvedValue("word1 word2 word3")

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    await act(async () => {
      await result.current.handlePasteFromClipboard()
    })

    expect(mockHandlePaste).toHaveBeenCalledWith("word1 word2 word3")
  })

  it("auto-navigates to step 2 when full valid phrase is pasted in step 1", () => {
    mockHandlePaste.mockReturnValue(true)
    const fullPhrase = "valid a b c d e f g h i j k"

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    let returned: boolean | undefined
    act(() => {
      returned = result.current.handlePaste(fullPhrase)
    })

    expect(returned).toBe(true)
    expect(mockNavigate).toHaveBeenCalledWith("sparkRestorePhraseScreen", {
      step: PhraseStep.Second,
      words: fullPhrase.split(" "),
    })
  })

  it("does not auto-navigate when paste happens on step 2", () => {
    mockHandlePaste.mockReturnValue(true)
    const fullPhrase = "valid a b c d e f g h i j k"

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.Second }))

    act(() => {
      result.current.handlePaste(fullPhrase)
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("does not auto-navigate when paste yields invalid mnemonic", () => {
    mockHandlePaste.mockReturnValue(true)

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    act(() => {
      result.current.handlePaste("invalid a b c d e f g h i j k")
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("does not paste when clipboard is empty", async () => {
    mockGetString.mockResolvedValue("")

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    await act(async () => {
      await result.current.handlePasteFromClipboard()
    })

    expect(mockHandlePaste).not.toHaveBeenCalled()
  })

  it("isValid is false when not all words filled", () => {
    mockBip39State.allFilled = false

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    expect(result.current.isValid).toBe(false)
  })

  it("isValid is true when all words valid", () => {
    mockBip39State.allFilled = true
    mockBip39State.words = "valid a b c d e f g h i j k".split(" ")

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    expect(result.current.isValid).toBe(true)
  })

  it("isValid is false when mnemonic invalid", () => {
    mockBip39State.allFilled = true
    mockBip39State.words = "invalid a b c d e f g h i j k".split(" ")

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    expect(result.current.isValid).toBe(false)
  })

  it("sets validation error on invalid mnemonic restore", async () => {
    mockBip39State.allFilled = true
    mockBip39State.words = "invalid a b c d e f g h i j k".split(" ")

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.Second }))

    await act(async () => {
      await result.current.handleRestore()
    })

    expect(result.current.validationError).toBe("Invalid mnemonic")
    expect(mockRestore).not.toHaveBeenCalled()
  })

  it("calls restore with valid mnemonic", async () => {
    mockBip39State.allFilled = true
    mockBip39State.words = "valid a b c d e f g h i j k".split(" ")
    mockRestore.mockResolvedValue(undefined)

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.Second }))

    await act(async () => {
      await result.current.handleRestore()
    })

    expect(mockRestore).toHaveBeenCalledWith("valid a b c d e f g h i j k")
    expect(result.current.validationError).toBeNull()
  })

  it("clears validation error on word update", () => {
    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    act(() => {
      result.current.updateWord(0, "test")
    })

    expect(mockUpdateWord).toHaveBeenCalledWith(0, "test")
  })
})
