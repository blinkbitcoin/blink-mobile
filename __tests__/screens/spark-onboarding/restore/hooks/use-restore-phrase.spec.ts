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
}))

jest.mock("@app/hooks/use-bip39-input", () => ({
  useBip39Input: () => ({
    words: Array(12).fill(""),
    stepWords: Array(6).fill(""),
    offset: 0,
    activeIndex: 0,
    setActiveIndex: jest.fn(),
    updateWord: jest.fn(),
    handlePaste: jest.fn().mockReturnValue(false),
    suggestions: [],
    selectSuggestion: jest.fn(),
    stepFilled: false,
    allFilled: false,
  }),
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
  })

  it("returns initial state", () => {
    const { result } = renderHook(() => useRestorePhrase({ step: PhraseStep.First }))

    expect(result.current.validationError).toBeNull()
    expect(result.current.status).toBe("idle")
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
})
