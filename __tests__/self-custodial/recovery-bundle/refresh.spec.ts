import { Network } from "@breeztech/breez-sdk-spark-react-native"

const mockFetchRecoveryBundle = jest.fn()
const mockAttemptSilentCloudUpload = jest.fn()
const mockReadBackupStateFor = jest.fn()
const mockReadRecoveryBundleSettings = jest.fn()
const mockSaveEncryptedBundleFile = jest.fn()
const mockLoadEncryptedBundleFile = jest.fn()
const mockReadRecoveryBundleState = jest.fn()
const mockWriteRecoveryBundleState = jest.fn()
const mockParseBundleBackupMetadata = jest.fn()
const mockCrashlyticsLog = jest.fn()
const mockCrashlyticsRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockCrashlyticsLog(...args),
  recordError: (...args: Error[]) => mockCrashlyticsRecordError(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/exporter", () => ({
  fetchRecoveryBundle: (...args: unknown[]) => mockFetchRecoveryBundle(...args),
}))

// Keep the real filename helpers so the filename assertions pin the actual
// production format; only the upload side effect is stubbed.
jest.mock("@app/self-custodial/recovery-bundle/cloud", () => ({
  ...jest.requireActual("@app/self-custodial/recovery-bundle/cloud"),
  attemptSilentCloudUpload: (...args: unknown[]) => mockAttemptSilentCloudUpload(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/encryption", () => ({
  buildEncryptedBundlePayload: async (bundle: { walletIdentityPublicKey: string }) =>
    JSON.stringify({
      network: "MAINNET",
      walletIdentityPublicKey: bundle.walletIdentityPublicKey,
      bundleCreatedAt: "2026-07-12T00:00:00.000Z",
      encrypted: true,
    }),
  parseBundleBackupMetadata: (...args: unknown[]) =>
    mockParseBundleBackupMetadata(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  saveEncryptedBundleFile: (...args: unknown[]) => mockSaveEncryptedBundleFile(...args),
  loadEncryptedBundleFile: (...args: unknown[]) => mockLoadEncryptedBundleFile(...args),
  readRecoveryBundleState: (...args: unknown[]) => mockReadRecoveryBundleState(...args),
  writeRecoveryBundleState: (...args: unknown[]) => mockWriteRecoveryBundleState(...args),
}))

// Keep the real gates (and the real status/method constants) so the cloud
// gating under test is production code, not a spec-side re-implementation.
// Only the storage read is stubbed.
jest.mock("@app/self-custodial/providers/backup-state", () => {
  const actual = jest.requireActual("@app/self-custodial/providers/backup-state")
  return {
    BackupStatus: actual.BackupStatus,
    BackupMethod: actual.BackupMethod,
    isCloudSeedBackupCompleted: actual.isCloudSeedBackupCompleted,
    isPasswordProtectedCloudSeedBackup: actual.isPasswordProtectedCloudSeedBackup,
    readBackupStateFor: (...args: unknown[]) => mockReadBackupStateFor(...args),
  }
})

jest.mock("@app/self-custodial/recovery-bundle/settings", () => ({
  ...jest.requireActual("@app/self-custodial/recovery-bundle/settings"),
  readRecoveryBundleSettings: (...args: unknown[]) =>
    mockReadRecoveryBundleSettings(...args),
}))

import { BackupMethod, BackupStatus } from "@app/self-custodial/providers/backup-state"
import {
  isBundleFresh,
  markCloudSynced,
  refreshRecoveryBundle,
  syncExistingBundleToCloud,
} from "@app/self-custodial/recovery-bundle/refresh"

const ACCOUNT_ID = "acct-1"

const testBundle = {
  createdAt: "2026-07-12T00:00:00.000Z",
  walletIdentityPublicKey: "02abcdef",
  leaves: [{ id: "leaf-1" }],
  balances: { btcSats: "32768" },
}

const savedPayload = JSON.stringify({
  network: "MAINNET",
  walletIdentityPublicKey: testBundle.walletIdentityPublicKey,
  bundleCreatedAt: testBundle.createdAt,
  encrypted: true,
})

const testState = {
  savedAt: 1,
  bundleCreatedAt: testBundle.createdAt,
  leafCount: 1,
  totalSats: "32768",
  cloudSyncedAt: null,
}

const cloudBackupState = {
  status: BackupStatus.Completed,
  method: BackupMethod.Cloud,
  cloudPasswordProtected: true,
}
// A cloud seed backup saved WITHOUT an extra password: the seed-encrypted
// bundle must never be uploaded next to it (PRD rule D9).
const passwordlessCloudBackupState = {
  status: BackupStatus.Completed,
  method: BackupMethod.Cloud,
}
const manualBackupState = { status: BackupStatus.Completed, method: BackupMethod.Manual }

const refreshParams = {
  accountId: ACCOUNT_ID,
  network: Network.Mainnet,
  mnemonic: "mnemonic",
  appVersion: "1.0.1",
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFetchRecoveryBundle.mockResolvedValue(testBundle)
  mockReadRecoveryBundleState.mockResolvedValue(null)
  mockAttemptSilentCloudUpload.mockResolvedValue({ success: true })
  // Cloud sync opted in by default here; the opt-out cases flip it per test.
  mockReadRecoveryBundleSettings.mockResolvedValue({
    autoRefresh: true,
    cloudSync: true,
  })
  mockParseBundleBackupMetadata.mockImplementation((raw: string) => {
    const parsed = JSON.parse(raw)
    return {
      network: parsed.network,
      walletIdentityPublicKey: parsed.walletIdentityPublicKey,
      bundleCreatedAt: parsed.bundleCreatedAt,
    }
  })
})

describe("refreshRecoveryBundle cloud gating", () => {
  it("uploads to the cloud when sync is opted in and the cloud seed backup is password-protected", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)

    const result = await refreshRecoveryBundle(refreshParams)

    expect(result.success).toBe(true)
    expect(mockSaveEncryptedBundleFile).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Mainnet,
      expect.any(String),
    )
    expect(mockAttemptSilentCloudUpload).toHaveBeenCalledWith(
      expect.any(String),
      "blink-spark-recovery-bundle-mainnet-02abcdef.json",
    )
  })

  it("skips the cloud upload when the user has not opted in to cloud sync", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    mockReadRecoveryBundleSettings.mockResolvedValue({
      autoRefresh: true,
      cloudSync: false,
    })

    const result = await refreshRecoveryBundle(refreshParams)

    expect(result.success).toBe(true)
    expect(mockSaveEncryptedBundleFile).toHaveBeenCalledTimes(1)
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
  })

  it("skips the cloud upload when the cloud seed backup has no password (D9)", async () => {
    mockReadBackupStateFor.mockResolvedValue(passwordlessCloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)

    const result = await refreshRecoveryBundle(refreshParams)

    expect(result.success).toBe(true)
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
  })

  it("skips the cloud upload when the seed backup is manual", async () => {
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)

    const result = await refreshRecoveryBundle(refreshParams)

    expect(result.success).toBe(true)
    expect(mockSaveEncryptedBundleFile).toHaveBeenCalledTimes(1)
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
  })

  it("skips the cloud upload when no seed backup exists", async () => {
    mockReadBackupStateFor.mockResolvedValue(null)

    await refreshRecoveryBundle(refreshParams)

    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
  })

  it("threads the network into every state read and write", async () => {
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)

    await refreshRecoveryBundle({ ...refreshParams, network: Network.Regtest })

    expect(mockSaveEncryptedBundleFile).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Regtest,
      expect.any(String),
    )
    expect(mockReadRecoveryBundleState).toHaveBeenCalledWith(ACCOUNT_ID, Network.Regtest)
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Regtest,
      expect.objectContaining({ leafCount: 1, totalSats: "32768" }),
    )
  })

  it("shares a single in-flight run between concurrent callers", async () => {
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)

    const [first, second] = await Promise.all([
      refreshRecoveryBundle(refreshParams),
      refreshRecoveryBundle(refreshParams),
    ])

    expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it("keys the in-flight run per network: same-network callers share, different networks run separately", async () => {
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)

    const mainnetFirst = refreshRecoveryBundle(refreshParams)
    const mainnetSecond = refreshRecoveryBundle(refreshParams)
    const regtest = refreshRecoveryBundle({ ...refreshParams, network: Network.Regtest })

    // Same account + same network coalesce; a different network on the same
    // account must not be handed the other network's in-flight run.
    expect(mainnetSecond).toBe(mainnetFirst)
    expect(regtest).not.toBe(mainnetFirst)

    await Promise.all([mainnetFirst, mainnetSecond, regtest])

    expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(2)
    expect(mockFetchRecoveryBundle).toHaveBeenCalledWith(
      expect.objectContaining({ network: Network.Mainnet }),
    )
    expect(mockFetchRecoveryBundle).toHaveBeenCalledWith(
      expect.objectContaining({ network: Network.Regtest }),
    )
  })

  it("preserves the previous cloudSyncedAt in the written state and returns the post-sync re-read", async () => {
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    const priorCloudSyncedAt = 1_752_000_000_000
    const previousState = { ...testState, cloudSyncedAt: priorCloudSyncedAt }
    const postSyncState = {
      ...testState,
      savedAt: 1_752_300_999_999,
      cloudSyncedAt: priorCloudSyncedAt,
    }
    mockReadRecoveryBundleState
      .mockResolvedValueOnce(previousState) // pre-write read of the previous state
      .mockResolvedValueOnce(postSyncState) // re-read after the cloud sync

    const result = await refreshRecoveryBundle(refreshParams)

    // Exact written object: cloudSyncedAt must carry over from the previous
    // state, not be reset to null on every refresh.
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Mainnet,
      {
        savedAt: expect.any(Number),
        bundleCreatedAt: testBundle.createdAt,
        leafCount: 1,
        totalSats: "32768",
        cloudSyncedAt: priorCloudSyncedAt,
      },
    )
    // The returned state is the post-sync re-read (identity, not a
    // structurally similar locally-built object).
    expect(result).toEqual({ success: true, state: postSyncState })
    if (result.success) expect(result.state).toBe(postSyncState)
  })

  it("resolves { success: false, error } instead of throwing when the fetch rejects", async () => {
    const failure = new Error("operators unreachable")
    mockFetchRecoveryBundle.mockRejectedValue(failure)

    const result = await refreshRecoveryBundle(refreshParams)

    expect(result).toEqual({ success: false, error: failure })
    expect(mockSaveEncryptedBundleFile).not.toHaveBeenCalled()
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })
})

describe("syncExistingBundleToCloud", () => {
  it("does nothing without a cloud seed backup", async () => {
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockLoadEncryptedBundleFile).not.toHaveBeenCalled()
  })

  it("does nothing when cloud sync is not opted in", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockReadRecoveryBundleSettings.mockResolvedValue({
      autoRefresh: true,
      cloudSync: false,
    })

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockLoadEncryptedBundleFile).not.toHaveBeenCalled()
  })

  it("does nothing when the cloud seed backup is not password-protected (D9)", async () => {
    mockReadBackupStateFor.mockResolvedValue(passwordlessCloudBackupState)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockLoadEncryptedBundleFile).not.toHaveBeenCalled()
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
  })

  it("does nothing when no bundle is saved yet", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(null)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockLoadEncryptedBundleFile).toHaveBeenCalledWith(ACCOUNT_ID, Network.Mainnet)
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
  })

  it("uploads the saved payload and records cloudSyncedAt", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    mockReadRecoveryBundleState.mockResolvedValue(testState)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(true)
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Mainnet,
      expect.objectContaining({ cloudSyncedAt: expect.any(Number) }),
    )
  })

  it("records a crashlytics error and returns false when the saved payload no longer parses", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue("corrupt-on-disk")
    mockParseBundleBackupMetadata.mockReturnValue(null)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockCrashlyticsRecordError).toHaveBeenCalledWith(expect.any(Error))
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("reports failure without stamping cloudSyncedAt when the upload fails", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    mockAttemptSilentCloudUpload.mockResolvedValue({ success: false, reason: "auth" })

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
    expect(mockCrashlyticsLog).toHaveBeenCalledWith(expect.stringContaining("auth"))
  })
})

describe("markCloudSynced", () => {
  it("stamps cloudSyncedAt on the existing state", async () => {
    mockReadRecoveryBundleState.mockResolvedValue(testState)

    const next = await markCloudSynced(ACCOUNT_ID, Network.Mainnet)

    expect(mockReadRecoveryBundleState).toHaveBeenCalledWith(ACCOUNT_ID, Network.Mainnet)
    expect(next).toEqual({ ...testState, cloudSyncedAt: expect.any(Number) })
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Mainnet,
      next,
    )
  })

  it("returns null and writes nothing when no state exists", async () => {
    mockReadRecoveryBundleState.mockResolvedValue(null)

    expect(await markCloudSynced(ACCOUNT_ID, Network.Mainnet)).toBeNull()
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })
})

describe("isBundleFresh", () => {
  const MAX_AGE_MS = 24 * 60 * 60 * 1000
  const NOW = 1_752_300_000_000

  const stateSavedAt = (savedAt: number) => ({ ...testState, savedAt })

  it("is false when no state is saved", () => {
    expect(isBundleFresh(null, NOW, MAX_AGE_MS)).toBe(false)
  })

  it("is true when the bundle is younger than the max age", () => {
    expect(isBundleFresh(stateSavedAt(NOW - MAX_AGE_MS + 1), NOW, MAX_AGE_MS)).toBe(true)
  })

  it("is false exactly at the max age threshold", () => {
    expect(isBundleFresh(stateSavedAt(NOW - MAX_AGE_MS), NOW, MAX_AGE_MS)).toBe(false)
  })

  it("is false when the bundle is older than the max age", () => {
    expect(isBundleFresh(stateSavedAt(NOW - MAX_AGE_MS - 1), NOW, MAX_AGE_MS)).toBe(false)
  })
})
