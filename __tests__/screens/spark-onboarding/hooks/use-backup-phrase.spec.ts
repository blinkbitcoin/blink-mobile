import { renderHook, act, waitFor } from "@testing-library/react-native"

import { useBackupPhrase } from "@app/screens/spark-onboarding/hooks/use-backup-phrase"
import { PhraseStep } from "@app/navigation/stack-param-lists"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ sparkCompatibleWalletsUrl: "https://example.com" }),
}))

jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
  useCountdown: () => ({ remainingSeconds: 0, isExpired: true }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupScreen: {
        ManualBackup: {
          Phrase: {
            copiedToast: () => "Copied",
            saveItNow: () => "Save it now",
            continueButton: () => "Continue",
            savedConfirm: () => "I have saved it",
          },
        },
      },
    },
    locale: "en",
  }),
}))

jest.mock("@app/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonicWords: () =>
    "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain".split(
      " ",
    ),
}))

jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  default: { open: jest.fn(() => Promise.resolve()) },
}))

describe("useBackupPhrase", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns first 6 words split into two cards for step 1", async () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First))

    await waitFor(() => {
      expect(result.current.firstCard).toHaveLength(3)
    })
    expect(result.current.secondCard).toHaveLength(3)
    expect(result.current.offset).toBe(0)
  })

  it("returns last 6 words split into two cards for step 2", async () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.Second))

    await waitFor(() => {
      expect(result.current.firstCard).toHaveLength(3)
    })
    expect(result.current.secondCard).toHaveLength(3)
    expect(result.current.offset).toBe(6)
  })

  it("navigates to step 2 on continue from step 1", async () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First))

    await waitFor(() => expect(result.current.firstCard.length).toBeGreaterThan(0))
    act(() => result.current.handleContinue())

    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupPhraseScreen", {
      step: PhraseStep.Second,
    })
  })

  it("navigates to confirm screen on continue from step 2", async () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.Second))

    await waitFor(() => expect(result.current.firstCard.length).toBeGreaterThan(0))
    act(() => result.current.handleContinue())

    expect(mockNavigate).toHaveBeenCalledWith(
      "sparkBackupConfirmScreen",
      expect.objectContaining({ challenges: expect.any(Array) }),
    )
  })

  it("returns 'Continue' as button title for step 1 when expired", () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First))
    expect(result.current.buttonTitle).toBe("Continue")
  })

  it("returns 'I have saved it' as button title for step 2", () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.Second))
    expect(result.current.buttonTitle).toBe("I have saved it")
  })

  it("button is not disabled for step 1 when expired", () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First))
    expect(result.current.isButtonDisabled).toBe(false)
  })

  it("button is not disabled for step 2", () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.Second))
    expect(result.current.isButtonDisabled).toBe(false)
  })
})
