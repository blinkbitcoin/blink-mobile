import { renderHook, act } from "@testing-library/react-native"
import { Platform } from "react-native"

import { useCloudBackup } from "@app/screens/self-custodial/onboarding/hooks/use-cloud-backup"

const mockCompleteBackup = jest.fn()
jest.mock("@app/screens/self-custodial/onboarding/hooks/use-complete-backup", () => ({
  useCompleteBackup: () => mockCompleteBackup,
}))

const mockStartSession = jest.fn()
const mockUpload = jest.fn()
const mockDownloadById = jest.fn()
let mockLoading = false

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Blink" } },
  }),
}))

jest.mock(
  "@app/screens/self-custodial/onboarding/hooks/use-platform-cloud-backup",
  () => ({
    usePlatformCloudBackup: () => ({
      startSession: mockStartSession,
      upload: mockUpload,
      downloadById: mockDownloadById,
      resolveErrorMessage: (reason: string) => `Sign-in failed: ${reason}`,
      loading: mockLoading,
    }),
  }),
)

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: readonly unknown[]) => mockRecordError(...args),
  log: jest.fn(),
}))

const mockLogBackupCompleted = jest.fn()
jest.mock("@app/self-custodial/analytics", () => ({
  logSelfCustodialBackupCompleted: (...args: readonly unknown[]) =>
    mockLogBackupCompleted(...args),
}))

jest.mock("@app/utils/crypto", () => ({
  deriveKeyFromPassword: () => ({
    key: "abcd1234abcd1234abcd1234abcd1234",
    salt: "c2FsdA==",
  }),
  encryptAesGcm: () => ({ data: "ZW5jcnlwdGVk", iv: "aXY=" }),
}))

let mockIdentityPubkey: string | null = "test-pubkey-1234"
let mockIdentityLoading = false
let mockMnemonic = "youth indicate void"
let mockMnemonicLoading = false
jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () => mockMnemonic,
  useWalletMnemonicState: () => ({
    mnemonic: mockMnemonic,
    loading: mockMnemonicLoading,
  }),
  useWalletIdentity: () => ({
    pubkey: mockIdentityPubkey ?? "",
    loading: mockIdentityLoading,
  }),
}))

let mockLightningAddress: string | null = null
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-info", () => ({
  useSelfCustodialAccountInfo: () => ({
    lightningAddress: mockLightningAddress,
  }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupMethod: { Cloud: "cloud", Keychain: "keychain", Manual: "manual" },
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
          cloudNotAvailable: () => "iCloud not available",
          networkError: () => "Network error",
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

type Session = { accessToken: string; existingFileId: string | undefined }
const noExistingFile: Session = { accessToken: "token", existingFileId: undefined }
const withExistingFile: Session = { accessToken: "token", existingFileId: "file-123" }
const sessionOk = (session: Session) => ({ success: true as const, session })

describe("useCloudBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockIdentityPubkey = "test-pubkey-1234"
    mockIdentityLoading = false
    mockMnemonic = "youth indicate void"
    mockMnemonicLoading = false
    mockLightningAddress = null
    mockStartSession.mockResolvedValue(sessionOk(noExistingFile))
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
    expect(mockCompleteBackup).toHaveBeenCalledWith({ method: "cloud" })
  })

  /** The success path tags the analytics event by platform; on android that is google_drive. */
  it("logs the google_drive backup method on android", async () => {
    const originalOS = Platform.OS
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true })
    mockUpload.mockResolvedValue({ success: true })

    try {
      const { result } = renderHook(() =>
        useCloudBackup({ isEncrypted: false, password: "" }),
      )
      await act(async () => {
        await result.current.handleBackup()
      })
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true })
    }

    expect(mockLogBackupCompleted).toHaveBeenCalledWith({ backupMethod: "google_drive" })
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
    expect(mockCompleteBackup).toHaveBeenCalledWith({ method: "cloud" })
  })

  it("shows the resolved failure message on upload failure", async () => {
    mockUpload.mockResolvedValue({ success: false, reason: "auth" })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sign-in failed: auth" }),
    )
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })

  it("does not double-report to crashlytics on upload failure — the inner hook owns Drive error telemetry", async () => {
    mockUpload.mockResolvedValue({ success: false, reason: "transient" })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("delegates the sign-in error message to the provider's resolveErrorMessage", async () => {
    mockStartSession.mockResolvedValue({ success: false, reason: "unknown" })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sign-in failed: unknown" }),
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it("stays silent when the user cancels the sign-in", async () => {
    mockStartSession.mockResolvedValue({ success: false, reason: "cancelled" })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })

  it("shows overwrite confirmation when backup exists", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
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

  it("shows lightning address and createdAt in the confirmation when metadata is available", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
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

  /** Checking the existing backup can refresh a revoked token; the upload must reuse the fresh
   *  one instead of the dead token the session started with. */
  it("uploads with the token refreshed while checking the existing backup", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
    mockDownloadById.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        version: 1,
        walletIdentifier: "test-pubkey-1234",
        encrypted: false,
        mnemonic: "youth indicate void",
      }),
      accessToken: "refreshed-token",
    })
    mockUpload.mockResolvedValue({ success: true })
    mockConfirmDialog.mockResolvedValue(true)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).toHaveBeenCalledWith(
      expect.any(String),
      "blink-spark-backup-blink-test-pubkey-1234.json",
      { accessToken: "refreshed-token", existingFileId: "file-123" },
    )
  })

  it("aborts with the resolved failure message when existing-backup verification fails (non-NotFound)", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
    mockDownloadById.mockResolvedValue({ success: false, reason: "transient" })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockDownloadById).toHaveBeenCalledTimes(1)
    expect(mockConfirmDialog).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sign-in failed: transient" }),
    )
  })

  it("falls back to the generic message when the existing file payload cannot be parsed", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
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

  it("uses placeholders when lightningAddress is missing and createdAt is zero", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
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

  it("does not fetch the existing backup when there is nothing to overwrite", async () => {
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
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
    mockConfirmDialog.mockResolvedValue(false)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockCompleteBackup).not.toHaveBeenCalled()
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

  it("aborts with a local backup error (not a sign-in error) when identityPubkey is missing", async () => {
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
      expect.objectContaining({ message: "Upload failed" }),
    )
  })

  it("reports loading and stays silent while the identity pubkey is still deriving", async () => {
    mockIdentityPubkey = null
    mockIdentityLoading = true

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    expect(result.current.loading).toBe(true)

    await act(async () => {
      await result.current.handleBackup()
    })

    /** Mid-derivation is a race with the disabled CTA, not a failure: no toast. */
    expect(mockStartSession).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  /** The keychain read runs before derivation can start, and leaves the pubkey empty
   *  without identityLoading ever being true — the longer of the two silent windows. */
  it("reports loading and stays silent while the phrase is still being read", async () => {
    mockMnemonic = ""
    mockMnemonicLoading = true
    mockIdentityPubkey = null
    mockIdentityLoading = false

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    expect(result.current.loading).toBe(true)

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockStartSession).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("still reports the local failure once the phrase read settles empty", async () => {
    mockMnemonic = ""
    mockMnemonicLoading = false
    mockIdentityPubkey = null
    mockIdentityLoading = false

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    expect(result.current.loading).toBe(false)

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Upload failed" }),
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
