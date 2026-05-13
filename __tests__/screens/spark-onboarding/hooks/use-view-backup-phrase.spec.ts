import { renderHook, act, waitFor } from "@testing-library/react-native"

import { useViewBackupPhrase } from "@app/screens/spark-onboarding/hooks/use-view-backup-phrase"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ sparkCompatibleWalletsUrl: "https://spark.example" }),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupScreen: {
        ManualBackup: {
          Phrase: { copiedToast: () => "Copied" },
          Success: { testSuccess: () => "Your backup phrase is correct" },
        },
      },
    },
  }),
}))

const mockOpenExternalUrl = jest.fn()
jest.mock("@app/utils/external", () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

jest.mock("@app/screens/spark-onboarding/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () =>
    "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain",
}))

describe("useViewBackupPhrase", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("exposes all 12 words from the secure storage mnemonic", async () => {
    const { result } = renderHook(() => useViewBackupPhrase())

    await waitFor(() => {
      expect(result.current.words).toHaveLength(12)
    })
    expect(result.current.words[0]).toBe("youth")
    expect(result.current.words[11]).toBe("captain")
  })

  it("copies the joined phrase with the localized toast message", async () => {
    const { result } = renderHook(() => useViewBackupPhrase())

    await waitFor(() => expect(result.current.words).toHaveLength(12))
    act(() => result.current.handleCopy())

    expect(mockCopyToClipboard).toHaveBeenCalledWith({
      content:
        "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain",
      message: "Copied",
    })
  })

  it("opens the spark-compatible wallets URL from remote config", () => {
    const { result } = renderHook(() => useViewBackupPhrase())

    act(() => result.current.handleOpenSparkLink())

    expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://spark.example")
  })

  it("navigates to the confirm screen with random challenges and the test-success message", async () => {
    const { result } = renderHook(() => useViewBackupPhrase())

    await waitFor(() => expect(result.current.words).toHaveLength(12))
    act(() => result.current.handleTestBackup())

    expect(mockNavigate).toHaveBeenCalledWith(
      "sparkBackupConfirmScreen",
      expect.objectContaining({
        challenges: expect.arrayContaining([
          expect.objectContaining({
            index: expect.any(Number),
            word: expect.any(String),
          }),
        ]),
        successMessage: "Your backup phrase is correct",
      }),
    )
    const lastCall = mockNavigate.mock.calls[0][1]
    expect(lastCall.challenges).toHaveLength(3)
  })
})
