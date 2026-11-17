import { renderHook, act, waitFor } from "@testing-library/react-native"

import {
  useBackupCountdownDeadline,
  useBackupPhrase,
} from "@app/screens/self-custodial/onboarding/hooks/use-backup-phrase"
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

const MNEMONIC =
  "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain"
let mockMnemonic = MNEMONIC
jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () => mockMnemonic,
}))

jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  default: { open: jest.fn(() => Promise.resolve()) },
}))

/** The deadline the screen would hold above its gate; the countdown itself is mocked. */
const getDeadline = () => new Date(0)

describe("useBackupPhrase", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMnemonic = MNEMONIC
  })

  it("shows no words while the mnemonic has not loaded", () => {
    mockMnemonic = ""

    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First, getDeadline))

    expect(result.current.firstCard).toEqual([])
    expect(result.current.secondCard).toEqual([])
  })

  it("returns first 6 words split into two cards for step 1", async () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First, getDeadline))

    await waitFor(() => {
      expect(result.current.firstCard).toHaveLength(3)
    })
    expect(result.current.secondCard).toHaveLength(3)
    expect(result.current.offset).toBe(0)
  })

  it("returns last 6 words split into two cards for step 2", async () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.Second, getDeadline))

    await waitFor(() => {
      expect(result.current.firstCard).toHaveLength(3)
    })
    expect(result.current.secondCard).toHaveLength(3)
    expect(result.current.offset).toBe(6)
  })

  it("navigates to step 2 on continue from step 1", async () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First, getDeadline))

    await waitFor(() => expect(result.current.firstCard.length).toBeGreaterThan(0))
    act(() => result.current.handleContinue())

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupPhrase", {
      step: PhraseStep.Second,
    })
  })

  it("navigates to confirm screen on continue from step 2", async () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.Second, getDeadline))

    await waitFor(() => expect(result.current.firstCard.length).toBeGreaterThan(0))
    act(() => result.current.handleContinue())

    expect(mockNavigate).toHaveBeenCalledWith(
      "selfCustodialBackupPhraseConfirm",
      expect.objectContaining({ challenges: expect.any(Array) }),
    )
  })

  it("returns 'Continue' as button title for step 1 when expired", () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First, getDeadline))
    expect(result.current.buttonTitle).toBe("Continue")
  })

  it("returns 'I have saved it' as button title for step 2", () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.Second, getDeadline))
    expect(result.current.buttonTitle).toBe("I have saved it")
  })

  it("button is not disabled for step 1 when expired", () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.First, getDeadline))
    expect(result.current.isButtonDisabled).toBe(false)
  })

  it("button is not disabled for step 2", () => {
    const { result } = renderHook(() => useBackupPhrase(PhraseStep.Second, getDeadline))
    expect(result.current.isButtonDisabled).toBe(false)
  })
})

/** The screen holds this above its screen-security gate, so it must not move when the
 *  gate mounts the words again, and must not start before they first show. */
describe("useBackupCountdownDeadline", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("fixes the deadline ten seconds after its first call, not after its creation", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000)
    const { result } = renderHook(() => useBackupCountdownDeadline())

    now.mockReturnValue(50_000)

    expect(result.current().getTime()).toBe(60_000)
  })

  it("returns the same deadline on every later call and render", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000)
    const { result, rerender } = renderHook(() => useBackupCountdownDeadline())
    const first = result.current()

    now.mockReturnValue(99_000)
    rerender({})

    expect(result.current()).toBe(first)
  })
})
