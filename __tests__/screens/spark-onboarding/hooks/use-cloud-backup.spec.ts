import { renderHook, act } from "@testing-library/react-native"

import { useCloudBackup } from "@app/screens/spark-onboarding/hooks/use-cloud-backup"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: jest.fn(),
}))

const mockStartSession = jest.fn()
const mockUpload = jest.fn()
const mockDownloadById = jest.fn()
let mockLoading = false

jest.mock("@app/hooks", () => ({
  useGoogleDriveBackup: () => ({
    startSession: mockStartSession,
    upload: mockUpload,
    downloadById: mockDownloadById,
    loading: mockLoading,
  }),
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Blink" } },
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: readonly unknown[]) => mockRecordError(...args),
}))

jest.mock("@app/utils/crypto", () => ({
  deriveKeyFromPassword: () => ({
    key: "abcd1234abcd1234abcd1234abcd1234",
    salt: "c2FsdA==",
  }),
  encryptAesGcm: () => ({ data: "ZW5jcnlwdGVk", iv: "aXY=" }),
}))

jest.mock("@app/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () => "youth indicate void",
}))

let mockIdentityPubkey: string | null = "test-pubkey-1234"
let mockLightningAddress: string | null = null
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-info", () => ({
  useSelfCustodialAccountInfo: () => ({
    identityPubkey: mockIdentityPubkey,
    lightningAddress: mockLightningAddress,
  }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  useBackupState: () => ({
    setBackupCompleted: jest.fn(),
  }),
}))

jest.mock("@app/utils/backup-payload", () => ({
  ...jest.requireActual("@app/utils/backup-payload"),
  buildBackupPayload: jest.fn(
    (
      _mnemonic: string,
      opts: {
        walletIdentifier: string
        lightningAddress?: string
        password?: string
        version?: number
      },
    ) =>
      JSON.stringify({
        version: opts.version ?? 1,
        walletIdentifier: opts.walletIdentifier,
        ...(opts.lightningAddress ? { lightningAddress: opts.lightningAddress } : {}),
        encrypted: Boolean(opts.password),
        mnemonic: opts.password ? "ZW5jcnlwdGVk" : "youth indicate void",
      }),
  ),
}))

const mockConfirmDialog = jest.fn()
jest.mock("@app/utils/confirm-dialog", () => ({
  confirmDialog: (...args: readonly unknown[]) => mockConfirmDialog(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { cancel: () => "Cancel" },
      BackupScreen: {
        BackupMethod: {
          googleDrive: () => "Google Drive",
          appleICloud: () => "Apple iCloud",
        },
        CloudBackup: {
          uploadSuccess: ({ provider }: { provider: string }) => `Saved to ${provider}`,
          uploadFailed: () => "Upload failed",
          signInFailed: () => "Sign in failed",
          existingBackupTitle: () => "Backup found",
          existingBackupMessage: ({ provider }: { provider: string }) =>
            `A backup exists in ${provider}. Overwrite?`,
          existingBackupMessageWithDetails: ({
            provider,
            address,
            createdAt,
          }: {
            provider: string
            address: string
            createdAt: string
          }) =>
            `Existing on ${provider} — Lightning address: ${address} / Created: ${createdAt}`,
          existingBackupUnknownAddress: () => "Not available",
          existingBackupUnknownCreatedAt: () => "Unknown",
          overwrite: () => "Overwrite",
        },
      },
    },
  }),
}))

const noExistingFile = { accessToken: "token", existingFileId: undefined }
const withExistingFile = { accessToken: "token", existingFileId: "file-123" }

describe("useCloudBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockIdentityPubkey = "test-pubkey-1234"
    mockLightningAddress = null
    mockStartSession.mockResolvedValue(noExistingFile)
    mockDownloadById.mockResolvedValue({ success: false, reason: "not-found" })
  })

  it("uploads unencrypted backup and navigates to success", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockStartSession).toHaveBeenCalledWith(
      "blink-spark-backup-blink-test-pubkey-1234.json",
    )
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"encrypted":false'),
      "blink-spark-backup-blink-test-pubkey-1234.json",
      noExistingFile,
    )
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("uploads encrypted backup when encryption enabled", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: true, password: "mypassword123" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"encrypted":true'),
      "blink-spark-backup-blink-test-pubkey-1234.json",
      noExistingFile,
    )
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("shows error toast on upload failure", async () => {
    mockUpload.mockResolvedValue({ success: false, reason: "auth" })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Upload failed" }),
    )
    expect(mockNavigate).not.toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("does not double-report to crashlytics on upload failure — the inner hook owns Drive error telemetry (Critical #8)", async () => {
    mockUpload.mockResolvedValue({ success: false, reason: "transient" })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("still reports to crashlytics on sign-in failure — that path is owned by use-cloud-backup, not the Drive hook (Critical #8)", async () => {
    const signInError = new Error("DEVELOPER_ERROR")
    mockStartSession.mockRejectedValue(signInError)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockRecordError).toHaveBeenCalledWith(signInError)
  })

  it("shows error toast on sign-in failure", async () => {
    mockStartSession.mockRejectedValue(new Error("DEVELOPER_ERROR"))

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sign in failed" }),
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it("shows overwrite confirmation when backup exists", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    mockUpload.mockResolvedValue({ success: true })
    mockConfirmDialog.mockResolvedValue(true)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Backup found",
        labels: expect.objectContaining({ confirm: "Overwrite" }),
      }),
    )
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"encrypted":false'),
      "blink-spark-backup-blink-test-pubkey-1234.json",
      withExistingFile,
    )
  })

  it("shows lightning address and createdAt in the confirmation when metadata is available (Important #15)", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    const createdAtMs = Date.UTC(2026, 4, 10, 18, 42, 0)
    mockDownloadById.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        version: 1,
        walletIdentifier: "test-pubkey-1234",
        lightningAddress: "alice@blink.sv",
        createdAt: createdAtMs,
        encrypted: false,
        mnemonic: "youth indicate void",
      }),
    })
    mockUpload.mockResolvedValue({ success: true })
    mockConfirmDialog.mockResolvedValue(true)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockDownloadById).toHaveBeenCalledWith("file-123", "token")
    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("alice@blink.sv"),
      }),
    )
    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Lightning address"),
      }),
    )
  })

  it("falls back to the generic confirmation message when metadata download fails (Important #15)", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    mockDownloadById.mockResolvedValue({ success: false, reason: "transient" })
    mockConfirmDialog.mockResolvedValue(false)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockDownloadById).toHaveBeenCalledTimes(1)
    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "A backup exists in Apple iCloud. Overwrite?",
      }),
    )
  })

  it("falls back to the generic message when the existing file payload cannot be parsed (Important #15)", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    mockDownloadById.mockResolvedValue({ success: true, content: "not-json" })
    mockConfirmDialog.mockResolvedValue(false)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "A backup exists in Apple iCloud. Overwrite?",
      }),
    )
  })

  it("uses placeholders when lightningAddress is missing and createdAt is zero (Important #15)", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    mockDownloadById.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        version: 1,
        walletIdentifier: "test-pubkey-1234",
        createdAt: 0,
        encrypted: false,
        mnemonic: "youth indicate void",
      }),
    })
    mockConfirmDialog.mockResolvedValue(false)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Not available"),
      }),
    )
    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Unknown"),
      }),
    )
  })

  it("does not fetch the existing backup when there is nothing to overwrite (Important #15)", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockDownloadById).not.toHaveBeenCalled()
    expect(mockConfirmDialog).not.toHaveBeenCalled()
  })

  it("does not upload when user cancels overwrite", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    mockConfirmDialog.mockResolvedValue(false)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("includes version in backup payload", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"version":1'),
      expect.stringContaining("blink-spark-backup"),
      noExistingFile,
    )
  })

  it("aborts and toasts when identityPubkey is missing", async () => {
    mockIdentityPubkey = null

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockStartSession).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sign in failed" }),
    )
  })

  it("includes walletIdentifier and lightningAddress in payload when set", async () => {
    mockLightningAddress = "alice@blink.sv"
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"walletIdentifier":"test-pubkey-1234"'),
      "blink-spark-backup-blink-test-pubkey-1234.json",
      noExistingFile,
    )
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"lightningAddress":"alice@blink.sv"'),
      expect.any(String),
      noExistingFile,
    )
  })

  it("omits lightningAddress in payload when null", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    const uploadedPayload = mockUpload.mock.calls[0][0] as string
    expect(uploadedPayload).not.toContain("lightningAddress")
  })
})
