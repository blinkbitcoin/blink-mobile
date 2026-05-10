import { renderHook, waitFor } from "@testing-library/react-native"

import { useCloudRestore } from "@app/screens/spark-onboarding/restore/hooks/use-cloud-restore"

const mockListBackups = jest.fn()
const mockDownloadById = jest.fn()
const mockRestore = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Main" } },
  }),
  useGoogleDriveBackup: () => ({
    listBackups: mockListBackups,
    downloadById: mockDownloadById,
    loading: false,
  }),
}))

jest.mock("@app/config/appinfo", () => ({
  getSparkDriveBackupFilenamePrefix: (name: string) =>
    `blink-spark-backup-${name.toLowerCase()}-`,
}))

jest.mock("@app/utils/backup-payload", () => ({
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
  parseBackupMetadata: (content: string) => {
    try {
      const parsed = JSON.parse(content) as {
        version?: number
        walletIdentifier?: string
        lightningAddress?: string
        encrypted?: boolean
        createdAt?: number
      }
      if (typeof parsed.walletIdentifier !== "string" || !parsed.walletIdentifier) {
        return null
      }
      return {
        version: parsed.version ?? 1,
        walletIdentifier: parsed.walletIdentifier,
        lightningAddress: parsed.lightningAddress,
        createdAt: parsed.createdAt ?? 0,
        encrypted: parsed.encrypted === true,
      }
    } catch {
      return null
    }
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

const buildPlainBackup = (walletIdentifier: string, mnemonic: string) =>
  JSON.stringify({
    version: 1,
    walletIdentifier,
    encrypted: false,
    mnemonic,
  })

const buildEncryptedBackup = (walletIdentifier: string, mnemonic: string) =>
  JSON.stringify({
    version: 1,
    walletIdentifier,
    encrypted: true,
    mnemonic,
    data: "enc",
    iv: "iv",
    salt: "salt",
  })

describe("useCloudRestore", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows not-found when no backups are listed", async () => {
    mockListBackups.mockResolvedValue({ entries: [], accessToken: "token" })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isNotFound).toBe(true)
    })
  })

  it("auto-restores when only one backup exists and it is unencrypted", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: buildPlainBackup("pubkey1", "word1 word2 word3"),
    })

    renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledWith("word1 word2 word3")
    })
  })

  it("shows password step when only one backup exists and it is encrypted", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: buildEncryptedBackup("pubkey1", "decrypted words"),
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isPassword).toBe(true)
    })
  })

  it("shows picker when multiple valid backups exist", async () => {
    mockListBackups.mockResolvedValue({
      entries: [
        { id: "file-1", name: "blink-spark-backup-main-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-main-pubkey2.json" },
      ],
      accessToken: "token",
    })
    mockDownloadById.mockImplementation((fileId: string) => {
      if (fileId === "file-1") {
        return Promise.resolve({
          success: true,
          content: buildPlainBackup("pubkey1", "words 1"),
        })
      }
      return Promise.resolve({
        success: true,
        content: buildPlainBackup("pubkey2", "words 2"),
      })
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isPicker).toBe(true)
    })
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.entries[0].metadata.walletIdentifier).toBe("pubkey1")
    expect(result.current.entries[1].metadata.walletIdentifier).toBe("pubkey2")
  })

  it("skips entries that fail to download or parse", async () => {
    mockListBackups.mockResolvedValue({
      entries: [
        { id: "file-1", name: "blink-spark-backup-main-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-main-bad.json" },
      ],
      accessToken: "token",
    })
    mockDownloadById.mockImplementation((fileId: string) => {
      if (fileId === "file-1") {
        return Promise.resolve({
          success: true,
          content: buildPlainBackup("pubkey1", "words 1"),
        })
      }
      return Promise.resolve({
        success: true,
        content: "garbage{",
      })
    })

    renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledWith("words 1")
    })
  })

  it("falls to NotFound when the single download returns reason='not-found' (Critical #8)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: false,
      reason: "not-found",
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isNotFound).toBe(true)
    })
  })

  it("falls to Error (not NotFound) when the single download fails with auth (Critical #8)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: false,
      reason: "auth",
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(result.current.isNotFound).toBe(false)
  })

  it("falls to Error (not NotFound) when the single download fails with transient (Critical #8)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: false,
      reason: "transient",
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(result.current.isNotFound).toBe(false)
  })

  it("falls to Error (not NotFound) when the single download fails with unknown (Critical #8)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: false,
      reason: "unknown",
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(result.current.isNotFound).toBe(false)
  })

  it("falls to Error in the picker flow when ALL per-file downloads fail with non-not-found reasons (Critical #8)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [
        { id: "file-1", name: "blink-spark-backup-main-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-main-pubkey2.json" },
      ],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({ success: false, reason: "transient" })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(result.current.isNotFound).toBe(false)
  })

  it("falls to NotFound only when ALL per-file downloads return not-found (Critical #8)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [
        { id: "file-1", name: "blink-spark-backup-main-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-main-pubkey2.json" },
      ],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({ success: false, reason: "not-found" })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isNotFound).toBe(true)
    })
  })

  it("falls to Error when a per-file download mixes not-found with a non-not-found failure (Critical #8)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [
        { id: "file-1", name: "blink-spark-backup-main-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-main-pubkey2.json" },
      ],
      accessToken: "token",
    })
    mockDownloadById.mockImplementation((fileId: string) =>
      Promise.resolve({
        success: false,
        reason: fileId === "file-1" ? "not-found" : "auth",
      }),
    )

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(result.current.isNotFound).toBe(false)
  })

  it("falls to NotFound when ALL per-file downloads succeed but metadata fails to parse (Critical #9)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [
        { id: "file-1", name: "blink-spark-backup-main-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-main-pubkey2.json" },
      ],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: "garbage{",
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isNotFound).toBe(true)
    })
    expect(result.current.hasError).toBe(false)
  })

  it("falls to NotFound on single-file path when downloaded content fails parseBackupMetadata (Critical #9)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: "garbage{",
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isNotFound).toBe(true)
    })
    expect(result.current.hasError).toBe(false)
    expect(mockRestore).not.toHaveBeenCalled()
  })

  it("does not call restore on single-file path when content lacks walletIdentifier (Critical #9)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: JSON.stringify({ version: 1, mnemonic: "words but no identifier" }),
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isNotFound).toBe(true)
    })
    expect(mockRestore).not.toHaveBeenCalled()
  })

  it("proceeds with the backup on single-file path when metadata parses successfully (Critical #9)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: buildPlainBackup("pubkey1", "valid words"),
    })

    renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledWith("valid words")
    })
  })

  it("reports per-file exceptions to crashlytics during picker assembly (Critical #8)", async () => {
    mockListBackups.mockResolvedValue({
      entries: [
        { id: "file-1", name: "blink-spark-backup-main-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-main-pubkey2.json" },
      ],
      accessToken: "token",
    })
    mockDownloadById.mockImplementation((fileId: string) => {
      if (fileId === "file-1") {
        return Promise.resolve({
          success: true,
          content: buildPlainBackup("pubkey1", "words 1"),
        })
      }
      return Promise.reject(new Error("boom"))
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRecordError).toHaveBeenCalled()
    })
    // The successful file still drives a single-success path → auto-restore.
    expect(result.current.hasError).toBe(false)
  })

  it("decrypts encrypted backup with correct password", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: buildEncryptedBackup("pubkey1", "decrypted words"),
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
      "@app/utils/backup-payload",
    ).parseEncryptedBackupPayload
    mockParseEncrypted.mockImplementationOnce(() => {
      throw new Error("decrypt failed")
    })

    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: buildEncryptedBackup("pubkey1", "decrypted words"),
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

  it("does not fire loadCloudBackups twice on rerender", async () => {
    mockListBackups.mockResolvedValue({
      entries: [{ id: "file-1", name: "blink-spark-backup-main-pubkey1.json" }],
      accessToken: "token",
    })
    mockDownloadById.mockResolvedValue({
      success: true,
      content: buildPlainBackup("pubkey1", "word1 word2 word3"),
    })

    const { rerender } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledTimes(1)
    })

    rerender({})

    expect(mockListBackups).toHaveBeenCalledTimes(1)
  })

  it("reports list errors to crashlytics and shows error step", async () => {
    mockListBackups.mockRejectedValue(new Error("sign-in failed"))

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(mockRecordError).toHaveBeenCalled()
    })
    expect(result.current.hasError).toBe(true)
  })

  it("handlePick downloads and restores the selected entry", async () => {
    mockListBackups.mockResolvedValue({
      entries: [
        { id: "file-1", name: "blink-spark-backup-main-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-main-pubkey2.json" },
      ],
      accessToken: "token",
    })
    mockDownloadById.mockImplementation((fileId: string) => {
      if (fileId === "file-1") {
        return Promise.resolve({
          success: true,
          content: buildPlainBackup("pubkey1", "words 1"),
        })
      }
      return Promise.resolve({
        success: true,
        content: buildPlainBackup("pubkey2", "words 2"),
      })
    })

    const { result } = renderHook(() => useCloudRestore())

    await waitFor(() => {
      expect(result.current.isPicker).toBe(true)
    })

    const targetEntry = result.current.entries.find(
      (e) => e.metadata.walletIdentifier === "pubkey2",
    )
    expect(targetEntry).toBeDefined()

    await waitFor(async () => {
      if (targetEntry) await result.current.handlePick(targetEntry)
    })

    expect(mockRestore).toHaveBeenCalledWith("words 2")
  })
})
