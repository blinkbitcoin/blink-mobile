import { renderHook, waitFor } from "@testing-library/react-native"

import { useCloudRestore } from "@app/screens/spark-onboarding/restore/hooks/use-cloud-restore"

const mockStartSession = jest.fn()
const mockDownload = jest.fn()
const mockRestore = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Main" } },
  }),
  useGoogleDriveBackup: () => ({
    startSession: mockStartSession,
    download: mockDownload,
    loading: false,
  }),
}))

jest.mock("@app/config/appinfo", () => ({
  getSparkDriveBackupFilename: (name: string) => `spark-backup-${name}.json`,
}))

jest.mock("@app/utils/spark-backup-format", () => ({
  isEncryptedBackup: (content: string) => {
    try {
      return JSON.parse(content)?.encrypted === true
    } catch {
      return false
    }
  },
  parseBackupPayload: (content: string) => {
    const parsed = JSON.parse(content) as { mnemonic: string }
    return { mnemonic: parsed.mnemonic }
  },
  parseEncryptedBackupPayload: jest.fn((content: string, _password: string) => {
    const parsed = JSON.parse(content) as { mnemonic: string }
    return { mnemonic: parsed.mnemonic }
  }),
}))

jest.mock("@app/screens/spark-onboarding/restore/hooks/use-restore-wallet", () => ({
  RestoreWalletStatus: { Idle: "idle", Restoring: "restoring", Error: "error" },
  useRestoreWallet: () => ({
    status: "idle",
    restore: mockRestore,
  }),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      RestoreScreen: {
        wrongPassword: () => "Wrong password",
      },
    },
  }),
}))

describe("useCloudRestore", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStartSession.mockResolvedValue({
      accessToken: "token",
      existingFileId: "file-id",
    })
  })

  it("restores unencrypted backup automatically", async () => {
    mockDownload.mockResolvedValue({
      success: true,
      content: JSON.stringify({ mnemonic: "word1 word2 word3" }),
    })

    renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledWith("word1 word2 word3")
    })
  })

  it("shows not-found when download fails", async () => {
    mockDownload.mockResolvedValue({
      success: false,
      error: "no-backup-found",
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isNotFound).toBe(true)
    })
  })

  it("shows password step for encrypted backup", async () => {
    mockDownload.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        mnemonic: null,
        encrypted: true,
        data: "enc",
        iv: "iv",
        salt: "salt",
      }),
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isPassword).toBe(true)
    })
  })

  it("shows error for corrupted/malformed JSON", async () => {
    mockDownload.mockResolvedValue({
      success: true,
      content: "not valid json {{{",
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(mockRecordError).toHaveBeenCalled()
  })

  it("decrypts encrypted backup with correct password", async () => {
    mockDownload.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        encrypted: true,
        mnemonic: "decrypted words",
        data: "enc",
        iv: "iv",
        salt: "salt",
      }),
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isPassword).toBe(true)
    })

    await waitFor(async () => {
      await result.current.handleDecrypt()
    })

    expect(mockRestore).toHaveBeenCalledWith("decrypted words")
  })

  it("shows password error on decrypt failure", async () => {
    const mockParseEncrypted = jest.requireMock(
      "@app/utils/spark-backup-format",
    ).parseEncryptedBackupPayload
    mockParseEncrypted.mockImplementationOnce(() => {
      throw new Error("decrypt failed")
    })

    mockDownload.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        encrypted: true,
        data: "enc",
        iv: "iv",
        salt: "salt",
      }),
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isPassword).toBe(true)
    })

    await waitFor(async () => {
      await result.current.handleDecrypt()
    })

    expect(result.current.passwordError).toBe("Wrong password")
  })

  it("does not fire attemptDownload twice on rerender", async () => {
    mockDownload.mockResolvedValue({
      success: true,
      content: JSON.stringify({ mnemonic: "word1 word2 word3" }),
    })

    const { rerender } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledTimes(1)
    })

    rerender({})

    expect(mockStartSession).toHaveBeenCalledTimes(1)
  })

  it("reports sign-in errors to crashlytics", async () => {
    mockStartSession.mockRejectedValue(new Error("sign-in failed"))

    renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRecordError).toHaveBeenCalled()
    })
  })
})
