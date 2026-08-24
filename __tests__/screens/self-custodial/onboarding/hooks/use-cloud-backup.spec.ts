import { renderHook, act, waitFor } from "@testing-library/react-native"
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

/** Only the crypto primitives are mocked — `buildBackupPayload` itself runs for real, so the
 *  assertions below see the payload shape that actually reaches the user's cloud. */
const mockEncryptAesGcm = jest.fn(() => ({ data: "ZW5jcnlwdGVk", iv: "aXY=" }))
jest.mock("@app/utils/crypto", () => ({
  PBKDF2_ITERATIONS: 600_000,
  PBKDF2_KEY_LENGTH: 16,
  PBKDF2_DIGEST: "SHA-256",
  deriveKeyFromPassword: () => ({
    key: "abcd1234abcd1234abcd1234abcd1234",
    salt: "c2FsdA==",
  }),
  encryptAesGcm: () => mockEncryptAesGcm(),
  decryptAesGcm: jest.fn(),
}))

const MNEMONIC = "youth indicate void"

let mockIdentityPubkey: string | null = "test-pubkey-1234"
let mockIdentityLoading = false
let mockMnemonic = MNEMONIC
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
          backupFailed: () => "Failed to create backup",
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
    mockMnemonic = MNEMONIC
    mockMnemonicLoading = false
    mockLightningAddress = null
    mockStartSession.mockResolvedValue(sessionOk(noExistingFile))
    mockDownloadById.mockResolvedValue({ success: false, reason: "not-found" })
  })

  it("uploads an encrypted backup and navigates to success", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockStartSession).toHaveBeenCalledWith(
      "blink-spark-backup-blink-test-pubkey-1234.json",
    )
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"encrypted":true'),
      "blink-spark-backup-blink-test-pubkey-1234.json",
      noExistingFile,
    )
    /** The point of the mandatory password: the phrase must not leave the device in the
     *  clear. `"encrypted":true` alone would still pass with a stray plaintext field. */
    expect(mockUpload.mock.calls[0][0]).not.toContain(MNEMONIC)
    expect(mockUpload.mock.calls[0][0]).not.toContain('"mnemonic"')
    expect(mockCompleteBackup).toHaveBeenCalledWith({ method: "cloud" })
  })

  it("does not upload the phrase in the clear when overwriting an existing backup", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
    mockDownloadById.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        version: 1,
        walletIdentifier: "test-pubkey-1234",
        encrypted: false,
        mnemonic: MNEMONIC,
      }),
    })
    mockUpload.mockResolvedValue({ success: true })
    mockConfirmDialog.mockResolvedValue(true)

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      await result.current.handleBackup()
    })

    /** The legacy plaintext backup being replaced carries the phrase; the replacement
     *  must not carry it forward. */
    expect(mockUpload.mock.calls[0][0]).not.toContain(MNEMONIC)
    expect(mockUpload.mock.calls[0][0]).toContain('"encrypted":true')
  })

  it("toasts and reports instead of throwing when encryption fails", async () => {
    mockEncryptAesGcm.mockImplementationOnce(() => {
      throw new Error("native crypto unavailable")
    })
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      await expect(result.current.handleBackup()).resolves.toBeUndefined()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to create backup" }),
    )
    /** Without the operation, a spike of native crypto failures lands on the dashboard as an
     *  anonymous Error and alerting keyed on the flow name never fires. */
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "native crypto unavailable" }),
      "Cloud backup encryption",
    )
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })

  /** The disabled Continue button is the only thing keeping an empty password out of here.
   *  Should that gate ever regress, the backup must fail loudly rather than upload plaintext. */
  it("aborts with a toast rather than uploading when the password is empty", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "" }))

    await act(async () => {
      await expect(result.current.handleBackup()).resolves.toBeUndefined()
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to create backup" }),
    )
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })

  /** A password below the policy minimum must not reach the encryption step: the builder
   *  owns the policy, so a caller wired to a weaker field fails loudly instead of shipping
   *  a weakly-encrypted mnemonic to the user's cloud. */
  it("aborts rather than uploading when the password is below the policy minimum", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "short" }))

    await act(async () => {
      await expect(result.current.handleBackup()).resolves.toBeUndefined()
    })

    expect(mockEncryptAesGcm).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to create backup" }),
    )
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })

  /** The press handler is not awaited, so nothing upstream serializes taps. A second tap
   *  while the first run is still in the sign-in sheet must be a no-op, not a second session
   *  racing a second upload onto the same file. */
  it("ignores a second handleBackup while the first is still in flight", async () => {
    let releaseSession: (sessionResult: unknown) => void = () => {}
    mockStartSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSession = resolve
        }),
    )
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      const first = result.current.handleBackup()
      const second = result.current.handleBackup()

      expect(mockStartSession).toHaveBeenCalledTimes(1)

      releaseSession(sessionOk(noExistingFile))
      await Promise.all([first, second])
    })

    expect(mockStartSession).toHaveBeenCalledTimes(1)
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockCompleteBackup).toHaveBeenCalledTimes(1)
  })

  /** The reviewer's exact scenario: a tap while the overwrite dialog is already open must
   *  not stack a second dialog, and must not turn one confirmation into two uploads. */
  it("does not stack a second overwrite dialog on a double tap", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
    let releaseDialog: (confirmed: boolean) => void = () => {}
    mockConfirmDialog.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          releaseDialog = resolve
        }),
    )
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      const first = result.current.handleBackup()
      await waitFor(() => expect(mockConfirmDialog).toHaveBeenCalledTimes(1))

      const second = result.current.handleBackup()
      releaseDialog(true)
      await Promise.all([first, second])
    })

    expect(mockConfirmDialog).toHaveBeenCalledTimes(1)
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  /** `loading` from the provider hook only covers upload/download. If the busy window ever
   *  narrows back to that, the CTA goes idle during sign-in, the overwrite dialog, and the
   *  synchronous 600k-iteration derivation — the exact window a second tap must be
   *  impossible in. `mockLoading` stays false here, so a true reading can only come from
   *  the hook's own busy state. */
  it("reports busy from the first tap through the upload, not only during the upload", async () => {
    let releaseSession: (sessionResult: unknown) => void = () => {}
    mockStartSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSession = resolve
        }),
    )
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    expect(result.current.loading).toBe(false)

    /** The busy flag is set synchronously by the tap, so a sync `act` flushes the render that
     *  the CTA reads; the session stays pending, pinning the state to the pre-upload window. */
    let run: Promise<void> | undefined
    act(() => {
      run = result.current.handleBackup()
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      releaseSession(sessionOk(noExistingFile))
      await run
    })

    expect(result.current.loading).toBe(false)
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  /** The success path tags the analytics event by platform; on android that is google_drive. */
  it("logs the google_drive backup method on android", async () => {
    const originalOS = Platform.OS
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true })
    mockUpload.mockResolvedValue({ success: true })

    try {
      const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))
      await act(async () => {
        await result.current.handleBackup()
      })
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true })
    }

    expect(mockLogBackupCompleted).toHaveBeenCalledWith({ backupMethod: "google_drive" })
  })

  it("shows the resolved failure message on upload failure", async () => {
    mockUpload.mockResolvedValue({ success: false, reason: "auth" })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("delegates the sign-in error message to the provider's resolveErrorMessage", async () => {
    mockStartSession.mockResolvedValue({ success: false, reason: "unknown" })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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
      expect.stringContaining('"encrypted":true'),
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
        mnemonic: MNEMONIC,
      }),
    })
    mockUpload.mockResolvedValue({ success: true })
    mockConfirmDialog.mockResolvedValue(true)

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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
        mnemonic: MNEMONIC,
      }),
      accessToken: "refreshed-token",
    })
    mockUpload.mockResolvedValue({ success: true })
    mockConfirmDialog.mockResolvedValue(true)

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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
        mnemonic: MNEMONIC,
      }),
    })
    mockConfirmDialog.mockResolvedValue(false)

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockDownloadById).not.toHaveBeenCalled()
    expect(mockConfirmDialog).not.toHaveBeenCalled()
  })

  it("does not upload when user cancels overwrite", async () => {
    mockStartSession.mockResolvedValue(sessionOk(withExistingFile))
    mockConfirmDialog.mockResolvedValue(false)

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })

  it("includes version in backup payload", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockStartSession).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to create backup" }),
    )
  })

  it("reports loading and stays silent while the identity pubkey is still deriving", async () => {
    mockIdentityPubkey = null
    mockIdentityLoading = true

    const { result } = renderHook(() => useCloudBackup({ password: "" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "" }))

    expect(result.current.loading).toBe(false)

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to create backup" }),
    )
  })

  it("includes walletIdentifier and lightningAddress in payload when set", async () => {
    mockLightningAddress = "alice@blink.sv"
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

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

    const { result } = renderHook(() => useCloudBackup({ password: "mypassword123" }))

    await act(async () => {
      await result.current.handleBackup()
    })

    const uploadedPayload = mockUpload.mock.calls[0][0] as string
    expect(uploadedPayload).not.toContain("lightningAddress")
  })
})
