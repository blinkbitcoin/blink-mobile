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
/** The account being backed up, which mid-migration is the provisioned
 *  self-custodial one rather than the still-custodial active account. */
let mockBackupAccountId: string | null = "account-1"
jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useBackupAccountId: () => mockBackupAccountId,
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
// The hook now records the recovery-bundle cloud-sync opt-in against the
// active self-custodial account, so the registry has to be stubbed.
let mockActiveAccount: { id: string; type: string } | null = {
  id: "account-1",
  type: "self-custodial",
}
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

const mockWriteSettings = jest.fn()
const mockReadSettings = jest.fn()
jest.mock("@app/self-custodial/recovery-bundle/settings", () => ({
  ...jest.requireActual("@app/self-custodial/recovery-bundle/settings"),
  readRecoveryBundleSettings: (...args: readonly unknown[]) => mockReadSettings(...args),
  writeRecoveryBundleSettings: (...args: readonly unknown[]) =>
    mockWriteSettings(...args),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-info", () => ({
  useSelfCustodialAccountInfo: () => ({
    lightningAddress: mockLightningAddress,
  }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupMethod: { Cloud: "cloud", Keychain: "keychain", Manual: "manual" },
}))

const mockRevokeCloudRecoveryBundle = jest.fn()
const mockSyncExistingBundleToCloud = jest.fn()
jest.mock("@app/self-custodial/recovery-bundle/refresh", () => ({
  revokeCloudRecoveryBundle: (...args: readonly unknown[]) =>
    mockRevokeCloudRecoveryBundle(...args),
  syncExistingBundleToCloud: (...args: readonly unknown[]) =>
    mockSyncExistingBundleToCloud(...args),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
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
          autoBundleSyncNotSaved: ({ provider }: { provider: string }) =>
            `Saved to ${provider}, sync choice not saved`,
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

const setDefaultMocks = () => {
  jest.clearAllMocks()
  mockLoading = false
  mockIdentityPubkey = "test-pubkey-1234"
  mockIdentityLoading = false
  mockMnemonic = "youth indicate void"
  mockMnemonicLoading = false
  mockLightningAddress = null
  mockBackupAccountId = "account-1"
  mockRevokeCloudRecoveryBundle.mockResolvedValue(true)
  mockSyncExistingBundleToCloud.mockResolvedValue(true)
  mockStartSession.mockResolvedValue(sessionOk(noExistingFile))
  mockDownloadById.mockResolvedValue({ success: false, reason: "not-found" })
  // Restored per test: jest.clearAllMocks() clears calls, not implementations,
  // so a case that makes one of these reject would otherwise leak into every
  // test after it.
  mockReadSettings.mockResolvedValue({
    autoRefresh: true,
    cloudSync: false,
    exportedAt: null,
  })
  mockWriteSettings.mockResolvedValue(undefined)
  // Restored here rather than at the end of a test body, so an assertion
  // failing mid-test cannot leak a custodial account into every case after.
  mockActiveAccount = { id: "account-1", type: "self-custodial" }
}

describe("useCloudBackup", () => {
  beforeEach(setDefaultMocks)

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
    // Recorded as NOT password-protected: the recovery-bundle cloud sync gate
    // (D9) must stay closed next to this unencrypted seed backup.
    expect(mockCompleteBackup).toHaveBeenCalledWith({
      method: "cloud",
      backupOptions: { cloudPasswordProtected: false },
    })
    expect(mockRevokeCloudRecoveryBundle).toHaveBeenCalledWith({
      accountId: "account-1",
      mnemonic: "youth indicate void",
    })
    const revokeOrder = mockRevokeCloudRecoveryBundle.mock.invocationCallOrder[0]
    const uploadOrder = mockUpload.mock.invocationCallOrder[0]
    expect(revokeOrder).toBeLessThan(uploadOrder)
  })

  it("aborts a passwordless upload when the recovery bundle cannot leave the cloud", async () => {
    mockRevokeCloudRecoveryBundle.mockResolvedValue(false)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )
    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockCompleteBackup).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Upload failed" }),
    )
  })

  it("aborts a passwordless upload when there is no backup account to revoke the bundle for", async () => {
    mockBackupAccountId = null

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )
    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockRevokeCloudRecoveryBundle).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Upload failed" }),
    )
  })

  it("revokes the bundle when encryption is on but no password was entered", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: true, password: "" }),
    )
    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockRevokeCloudRecoveryBundle).toHaveBeenCalledTimes(1)
    expect(mockCompleteBackup).toHaveBeenCalledWith({
      method: "cloud",
      backupOptions: { cloudPasswordProtected: false },
    })
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
    expect(mockCompleteBackup).toHaveBeenCalledWith({
      method: "cloud",
      backupOptions: { cloudPasswordProtected: true },
    })
    // A password-protected seed cannot decrypt the bundle on its own, so the
    // bundle stays in the cloud.
    expect(mockRevokeCloudRecoveryBundle).not.toHaveBeenCalled()
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
    // Revoking turns the bundle opt-in off, so it waits for the confirmed overwrite.
    expect(mockRevokeCloudRecoveryBundle).not.toHaveBeenCalled()
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

const protectedBackup = {
  isEncrypted: true,
  password: "hunter2hunter2",
  isAutoBundleSyncKnown: true,
}

const runBackup = async (params: Parameters<typeof useCloudBackup>[0]) => {
  const { result } = renderHook(() => useCloudBackup(params))
  await act(async () => {
    await result.current.handleBackup()
  })
  return result
}

describe("useCloudBackup recovery-bundle cloud sync choice", () => {
  beforeEach(() => {
    setDefaultMocks()
    mockUpload.mockResolvedValue({ success: true })
  })

  it("leaves the stored choice alone when the form could not learn it", async () => {
    // Off by default (D4), and an unreadable setting must not pass for a
    // deliberate opt-out of one the user made earlier.
    await runBackup({ isEncrypted: true, password: "hunter2hunter2" })

    expect(mockReadSettings).not.toHaveBeenCalled()
    expect(mockWriteSettings).not.toHaveBeenCalled()
  })

  it("records the opt-in once the seed backup landed", async () => {
    await runBackup({ ...protectedBackup, autoBundleSync: true })

    expect(mockWriteSettings).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ cloudSync: true }),
    )
  })

  it("records an opt-out of a choice stored earlier", async () => {
    mockReadSettings.mockResolvedValue({ autoRefresh: true, cloudSync: true })

    await runBackup({ ...protectedBackup, autoBundleSync: false })

    expect(mockWriteSettings).toHaveBeenCalledWith("account-1", {
      autoRefresh: true,
      cloudSync: false,
    })
    expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
  })

  /** A stored opt-in whose last upload failed would otherwise sit out of the
   *  cloud until the next payment, re-backup or not. */
  it("does not rewrite a stored opt-in but still uploads the bundle on disk", async () => {
    mockReadSettings.mockResolvedValue({ autoRefresh: true, cloudSync: true })

    await runBackup({ ...protectedBackup, autoBundleSync: true })

    expect(mockWriteSettings).not.toHaveBeenCalled()
    expect(mockSyncExistingBundleToCloud).toHaveBeenCalledWith("account-1", "regtest")
  })

  /** The refresh hook syncs straight away only when the seed backup turns
   *  password-protected; a re-backup over one that already was would leave the
   *  bundle on disk out of the cloud until the next payment. */
  it("uploads the bundle on disk right after the opt-in is recorded", async () => {
    await runBackup({ ...protectedBackup, autoBundleSync: true })

    expect(mockSyncExistingBundleToCloud).toHaveBeenCalledWith("account-1", "regtest")
    const writeOrder = mockWriteSettings.mock.invocationCallOrder[0]
    const syncOrder = mockSyncExistingBundleToCloud.mock.invocationCallOrder[0]
    expect(writeOrder).toBeLessThan(syncOrder)
  })

  it("still reports success when the upload after the opt-in fails", async () => {
    mockSyncExistingBundleToCloud.mockRejectedValue(new Error("drive unreachable"))

    await runBackup({ ...protectedBackup, autoBundleSync: true })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Saved to Apple iCloud", type: "success" }),
    )
  })

  it("refuses the opt-in without a password on the seed backup (D9)", async () => {
    await runBackup({
      isEncrypted: false,
      password: "",
      autoBundleSync: true,
      isAutoBundleSyncKnown: true,
    })

    // The seed-encrypted bundle must never sit next to an unencrypted seed: the
    // revocation already turned the opt-in off.
    expect(mockWriteSettings).not.toHaveBeenCalled()
  })

  it("says plainly that the choice was not saved instead of reporting full success", async () => {
    mockWriteSettings.mockRejectedValue(new Error("disk full"))

    const result = await runBackup({ ...protectedBackup, autoBundleSync: true })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Saved to Apple iCloud, sync choice not saved",
        type: "warning",
      }),
    )
    expect(mockToastShow).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    )
    // The seed reached the provider, so the backup itself still completes.
    expect(mockCompleteBackup).toHaveBeenCalledWith(
      expect.objectContaining({ method: "cloud" }),
    )
    expect(result.current.loading).toBe(false)
  })

  it("warns and skips the write when the stored settings cannot be read", async () => {
    mockReadSettings.mockRejectedValue(new Error("storage unavailable"))

    await runBackup({ ...protectedBackup, autoBundleSync: true })

    // Writing without the read would replace the whole record and silently flip
    // an autoRefresh the user had turned off.
    expect(mockWriteSettings).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning" }),
    )
    expect(mockCompleteBackup).toHaveBeenCalledWith(
      expect.objectContaining({ method: "cloud" }),
    )
  })

  it("preserves the stored settings when recording the choice", async () => {
    mockReadSettings.mockResolvedValue({ autoRefresh: false, cloudSync: false })

    await runBackup({ ...protectedBackup, autoBundleSync: true })

    expect(mockWriteSettings).toHaveBeenCalledWith(expect.any(String), {
      autoRefresh: false,
      cloudSync: true,
    })
  })

  /** Mid-migration the active account is still the custodial one while the
   *  phrase being uploaded belongs to the provisioned self-custodial account. */
  it("reads and records the choice against the migration account, not the active one", async () => {
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockBackupAccountId = "migration-account-1"

    await runBackup({ ...protectedBackup, autoBundleSync: true })

    expect(mockReadSettings).toHaveBeenCalledWith("migration-account-1")
    expect(mockWriteSettings).toHaveBeenCalledWith(
      "migration-account-1",
      expect.objectContaining({ cloudSync: true }),
    )
  })

  it("has no choice to record when there is no account to record it against", async () => {
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockBackupAccountId = null

    await runBackup({ ...protectedBackup, autoBundleSync: true })

    expect(mockWriteSettings).not.toHaveBeenCalled()
  })

  it("does not record the choice when the upload failed", async () => {
    mockUpload.mockResolvedValue({ success: false, reason: "network" })

    await runBackup({ ...protectedBackup, autoBundleSync: true })

    // Otherwise sync points at a provider holding no seed backup at all.
    expect(mockWriteSettings).not.toHaveBeenCalled()
  })
})

describe("useCloudBackup one backup at a time", () => {
  beforeEach(setDefaultMocks)

  const openingSession = () => {
    let openSession: (result: ReturnType<typeof sessionOk>) => void = () => {}
    mockStartSession.mockReturnValue(
      new Promise((resolve) => {
        openSession = resolve
      }),
    )
    return (result: ReturnType<typeof sessionOk>) => openSession(result)
  }

  it("reports busy from the first tap, while the session is still opening", async () => {
    mockUpload.mockResolvedValue({ success: true })
    const openSession = openingSession()
    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: true, password: "a passphrase long enough" }),
    )
    expect(result.current.loading).toBe(false)

    let backingUp: Promise<void | undefined> = Promise.resolve(undefined)
    await act(async () => {
      backingUp = result.current.handleBackup()
    })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      openSession(sessionOk(noExistingFile))
      await backingUp
    })
    expect(result.current.loading).toBe(false)
  })

  it("ignores a second tap while the first backup is still opening its session", async () => {
    mockUpload.mockResolvedValue({ success: true })
    const openSession = openingSession()
    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: true, password: "a passphrase long enough" }),
    )

    let first: Promise<void | undefined> = Promise.resolve(undefined)
    await act(async () => {
      first = result.current.handleBackup()
      await result.current.handleBackup()
    })
    await act(async () => {
      openSession(sessionOk(noExistingFile))
      await first
    })

    expect(mockStartSession).toHaveBeenCalledTimes(1)
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  it("stays busy, and ignores another tap, until the backup's completion settles", async () => {
    // Mid-migration the completion still writes the provisioned account's
    // backup state and checkpoint after the upload has landed.
    mockUpload.mockResolvedValue({ success: true })
    let settleCompletion: () => void = () => {}
    mockCompleteBackup.mockReturnValue(
      new Promise<void>((resolve) => {
        settleCompletion = resolve
      }),
    )
    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: true, password: "a passphrase long enough" }),
    )

    let backingUp: Promise<void | undefined> = Promise.resolve(undefined)
    await act(async () => {
      backingUp = result.current.handleBackup()
    })
    expect(mockCompleteBackup).toHaveBeenCalledTimes(1)
    expect(result.current.loading).toBe(true)

    await act(async () => {
      await result.current.handleBackup()
    })
    expect(mockStartSession).toHaveBeenCalledTimes(1)

    await act(async () => {
      settleCompletion()
      await backingUp
    })
    expect(result.current.loading).toBe(false)
  })
})
