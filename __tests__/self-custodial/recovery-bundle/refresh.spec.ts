import { Network } from "@breeztech/breez-sdk-spark-react-native"

const mockFetchRecoveryBundle = jest.fn()
const mockAttemptSilentCloudUpload = jest.fn()
const mockReadBackupStateFor = jest.fn()
const mockSaveEncryptedBundleFile = jest.fn()
const mockLoadEncryptedBundleFile = jest.fn()
const mockReadRecoveryBundleState = jest.fn()
const mockWriteRecoveryBundleState = jest.fn()

jest.mock("@app/self-custodial/recovery-bundle/exporter", () => ({
  fetchRecoveryBundle: (...args: unknown[]) => mockFetchRecoveryBundle(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/cloud", () => ({
  attemptSilentCloudUpload: (...args: unknown[]) => mockAttemptSilentCloudUpload(...args),
  getRecoveryBundleFilename: (network: string, id: string) =>
    `blink-spark-recovery-bundle-${network.toLowerCase()}-${id}.json`,
}))

jest.mock("@app/self-custodial/recovery-bundle/encryption", () => ({
  buildEncryptedBundlePayload: (bundle: { walletIdentityPublicKey: string }) =>
    JSON.stringify({
      network: "MAINNET",
      walletIdentityPublicKey: bundle.walletIdentityPublicKey,
      bundleCreatedAt: "2026-07-12T00:00:00.000Z",
      encrypted: true,
    }),
  parseBundleBackupMetadata: (raw: string) => {
    const parsed = JSON.parse(raw)
    return {
      network: parsed.network,
      walletIdentityPublicKey: parsed.walletIdentityPublicKey,
      bundleCreatedAt: parsed.bundleCreatedAt,
    }
  },
}))

jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  saveEncryptedBundleFile: (...args: unknown[]) => mockSaveEncryptedBundleFile(...args),
  loadEncryptedBundleFile: (...args: unknown[]) => mockLoadEncryptedBundleFile(...args),
  readRecoveryBundleState: (...args: unknown[]) => mockReadRecoveryBundleState(...args),
  writeRecoveryBundleState: (...args: unknown[]) => mockWriteRecoveryBundleState(...args),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupStatus: { None: "none", Pending: "pending", Completed: "completed" },
  BackupMethod: { Cloud: "cloud", Keychain: "keychain", Manual: "manual" },
  readBackupStateFor: (...args: unknown[]) => mockReadBackupStateFor(...args),
}))

import {
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

const cloudBackupState = { status: "completed", method: "cloud" }
const manualBackupState = { status: "completed", method: "manual" }

const refreshParams = {
  accountId: ACCOUNT_ID,
  network: Network.Mainnet,
  mnemonic: "mnemonic",
  appVersion: "1.0.1",
}

describe("refreshRecoveryBundle cloud gating", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchRecoveryBundle.mockResolvedValue(testBundle)
    mockReadRecoveryBundleState.mockResolvedValue(null)
    mockAttemptSilentCloudUpload.mockResolvedValue({ success: true })
  })

  it("uploads to the cloud when the seed backup method is cloud", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockImplementation(async () =>
      JSON.stringify({
        network: "MAINNET",
        walletIdentityPublicKey: testBundle.walletIdentityPublicKey,
        bundleCreatedAt: testBundle.createdAt,
        encrypted: true,
      }),
    )

    const result = await refreshRecoveryBundle(refreshParams)

    expect(result.success).toBe(true)
    expect(mockSaveEncryptedBundleFile).toHaveBeenCalledTimes(1)
    expect(mockAttemptSilentCloudUpload).toHaveBeenCalledWith(
      expect.any(String),
      "blink-spark-recovery-bundle-mainnet-02abcdef.json",
    )
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

  it("shares a single in-flight run between concurrent callers", async () => {
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)

    const [first, second] = await Promise.all([
      refreshRecoveryBundle(refreshParams),
      refreshRecoveryBundle(refreshParams),
    ])

    expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })
})

describe("syncExistingBundleToCloud", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAttemptSilentCloudUpload.mockResolvedValue({ success: true })
  })

  it("does nothing without a cloud seed backup", async () => {
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockLoadEncryptedBundleFile).not.toHaveBeenCalled()
  })

  it("does nothing when no bundle is saved yet", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(null)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
  })

  it("uploads the saved payload and records cloudSyncedAt", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(
      JSON.stringify({
        network: "MAINNET",
        walletIdentityPublicKey: "02abcdef",
        bundleCreatedAt: "2026-07-12T00:00:00.000Z",
        encrypted: true,
      }),
    )
    mockReadRecoveryBundleState.mockResolvedValue({
      savedAt: 1,
      bundleCreatedAt: "2026-07-12T00:00:00.000Z",
      leafCount: 1,
      totalSats: "32768",
      cloudSyncedAt: null,
    })

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(true)
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({ cloudSyncedAt: expect.any(Number) }),
    )
  })

  it("reports failure without touching state when the upload fails", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(
      JSON.stringify({
        network: "MAINNET",
        walletIdentityPublicKey: "02abcdef",
        bundleCreatedAt: "2026-07-12T00:00:00.000Z",
        encrypted: true,
      }),
    )
    mockAttemptSilentCloudUpload.mockResolvedValue({ success: false, reason: "auth" })

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })
})
