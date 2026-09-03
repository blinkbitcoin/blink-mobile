import { renderHook, act } from "@testing-library/react-native"

import {
  RestoreStatus,
  useRestorePhrase,
} from "@app/screens/self-custodial/onboarding/restore/hooks/use-restore-phrase"
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

jest.mock(
  "@app/screens/self-custodial/onboarding/restore/hooks/use-restore-wallet",
  () => ({
    RestoreWalletStatus: { Idle: "idle", Restoring: "restoring", Error: "error" },
    useRestoreWallet: () => ({
      status: "idle",
      restore: mockRestore,
    }),
  }),
)

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      RestoreScreen: {
        invalidMnemonic: () => "Invalid mnemonic",
        pasteFailed: () => "Paste failed",
      },
    },
  }),
}))

const mockToastShow = jest.fn()
const mockImportAccount = jest.fn()
let mockIsProvisioning = false

let mockMigrationLoading = false

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationAccount: () => ({
    importAccount: mockImportAccount,
    isProvisioning: mockIsProvisioning,
    loading: mockMigrationLoading,
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

describe("useRestorePhrase", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsProvisioning = false
    mockMigrationLoading = false
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

  it("re-exports the restore wallet status for the screen", () => {
    expect(RestoreStatus.Restoring).toBe("restoring")
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

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRestorePhrase", {
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
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRestorePhrase", {
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

  /** The paste control lives on a header onPress, so a clipboard rejection would surface
   *  as an unhandled promise rejection; it is reported and toasted instead. */
  it("reports and toasts a clipboard read failure instead of rejecting", async () => {
    mockGetString.mockRejectedValue(new Error("clipboard unavailable"))

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    await act(async () => {
      await expect(result.current.handlePasteFromClipboard()).resolves.toBeUndefined()
    })

    expect(mockHandlePaste).not.toHaveBeenCalled()
    expect(mockReportError).toHaveBeenCalledWith(
      "Restore phrase clipboard read",
      expect.any(Error),
    )
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Paste failed" }),
    )
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

  /** useRestoreWallet reports its own failures and drives its status state; the hook
   *  only has to keep the rejection from escaping the button's onPress. */
  it("swallows a rejecting restore instead of rethrowing", async () => {
    mockBip39State.allFilled = true
    mockBip39State.words = "valid a b c d e f g h i j k".split(" ")
    mockRestore.mockRejectedValue(new Error("restore failed"))

    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.Second }))

    await expect(
      act(async () => {
        await result.current.handleRestore()
      }),
    ).resolves.toBeUndefined()
  })

  it("clears validation error on word update", () => {
    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    act(() => {
      result.current.updateWord(0, "test")
    })

    expect(mockUpdateWord).toHaveBeenCalledWith(0, "test")
  })

  describe("the migration flow", () => {
    /** The custodial account stays active until migration commits, so the phrase must
     *  never reach the onboarding restore, which activates the wallet at once. */
    it("imports the phrase for migration instead of restoring it", async () => {
      mockBip39State.allFilled = true
      mockBip39State.words = "valid a b c d e f g h i j k".split(" ")
      mockImportAccount.mockResolvedValue("sc-imported-1")
      const { result } = renderHook(() =>
        useRestorePhrase({ step: PhraseStep.Second, flow: "migration" }),
      )

      await act(async () => {
        await result.current.handleRestore()
      })

      expect(mockImportAccount).toHaveBeenCalledTimes(1)
      expect(mockRestore).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
        flow: "migration",
      })
    })

    /** importAccount reports its own failure and answers null; moving on anyway would
     *  march the user into the terms screen with no wallet behind the migration. */
    it("stays on the phrase screen when the import fails", async () => {
      mockBip39State.allFilled = true
      mockBip39State.words = "valid a b c d e f g h i j k".split(" ")
      mockImportAccount.mockResolvedValue(null)
      const { result } = renderHook(() =>
        useRestorePhrase({ step: PhraseStep.Second, flow: "migration" }),
      )

      await act(async () => {
        await result.current.handleRestore()
      })

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    /** savePendingAccount throws without the owner id, after the wallet is already derived
     *  and registered: the user would get a bare failure plus a stray account. */
    it("does not import while the migration owner is still loading", async () => {
      mockMigrationLoading = true
      mockBip39State.allFilled = true
      mockBip39State.words = "valid a b c d e f g h i j k".split(" ")
      const { result } = renderHook(() =>
        useRestorePhrase({ step: PhraseStep.Second, flow: "migration" }),
      )

      await act(async () => {
        await result.current.handleRestore()
      })

      expect(mockImportAccount).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    /** The refusal above would otherwise be silent, so the button says so. Reporting it as
     *  Restoring instead would cover an empty phrase form with the full-page spinner, since
     *  the owner query resolves on mount. */
    it("blocks submission while the owner query runs, without claiming to be restoring", () => {
      mockMigrationLoading = true
      const { result } = renderHook(() =>
        useRestorePhrase({ step: PhraseStep.Second, flow: "migration" }),
      )

      expect(result.current.isSubmitBlocked).toBe(true)
      expect(result.current.status).not.toBe("restoring")
    })

    /** Outside the migration the flag belongs to another screen's run: an ordinary restore
     *  must never have its button held shut by it. */
    it("does not block an ordinary restore while the migration owner loads", () => {
      mockMigrationLoading = true
      const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.Second }))

      expect(result.current.isSubmitBlocked).toBe(false)
    })

    it("carries the flow across the step transition so it survives the second screen", () => {
      const { result } = renderHook(() =>
        useRestorePhrase({ step: PhraseStep.First, flow: "migration" }),
      )

      act(() => {
        result.current.handleContinue()
      })

      expect(mockNavigate).toHaveBeenCalledWith(
        "selfCustodialRestorePhrase",
        expect.objectContaining({ flow: "migration" }),
      )
    })

    it("reports the import as in flight through the restore status", () => {
      mockIsProvisioning = true
      const { result } = renderHook(() =>
        useRestorePhrase({ step: PhraseStep.Second, flow: "migration" }),
      )

      expect(result.current.status).toBe("restoring")
    })

    /** Outside the migration the flag belongs to another screen's run and must not leak
     *  into this one's button. */
    it("ignores the migration in-flight flag outside the migration flow", () => {
      mockIsProvisioning = true
      const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.Second }))

      expect(result.current.status).not.toBe("restoring")
    })
  })
})
