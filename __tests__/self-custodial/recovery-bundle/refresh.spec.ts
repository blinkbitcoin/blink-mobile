import { Network } from "@breeztech/breez-sdk-spark-react-native"

const mockFetchRecoveryBundle = jest.fn()
const mockAttemptSilentCloudUpload = jest.fn()
const mockAttemptSilentCloudDelete = jest.fn()
const mockReadBackupStateFor = jest.fn()
const mockReadRecoveryBundleSettings = jest.fn()
const mockWriteRecoveryBundleSettings = jest.fn()
const mockSaveEncryptedBundleFile = jest.fn()
const mockLoadEncryptedBundleFile = jest.fn()
const mockReadRecoveryBundleState = jest.fn()
const mockWriteRecoveryBundleState = jest.fn()
const mockParseBundleBackupMetadata = jest.fn()
const mockRecordAppError = jest.fn()
const mockDeriveIdentityKeyPair = jest.fn()

// The reporting boundary is mocked (not crashlytics underneath it) so the
// expected/dedupKey classification is asserted directly, and because
// recordAppError's module-level dedup set would swallow repeat asserts
// across tests. crashlytics stays mocked for the requireActual import below.
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: jest.fn(),
  recordError: jest.fn(),
}))

jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/exporter", () => ({
  fetchRecoveryBundle: (...args: unknown[]) => mockFetchRecoveryBundle(...args),
}))

// Keep the real filename helpers so the filename assertions pin the actual
// production format; only the upload side effect is stubbed.
jest.mock("@app/self-custodial/recovery-bundle/cloud", () => ({
  ...jest.requireActual("@app/self-custodial/recovery-bundle/cloud"),
  attemptSilentCloudUpload: (...args: unknown[]) => mockAttemptSilentCloudUpload(...args),
  attemptSilentCloudDelete: (...args: unknown[]) => mockAttemptSilentCloudDelete(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/identity", () => ({
  deriveIdentityKeyPair: (...args: unknown[]) => mockDeriveIdentityKeyPair(...args),
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
  writeRecoveryBundleSettings: (...args: unknown[]) =>
    mockWriteRecoveryBundleSettings(...args),
}))

import { BackupMethod, BackupStatus } from "@app/self-custodial/providers/backup-state"
import {
  isBundleFresh,
  markAccountDeletedForRefresh,
  markCloudSynced,
  markRecoveryBundleStale,
  refreshRecoveryBundle,
  revokeCloudRecoveryBundle,
  syncExistingBundleToCloud,
  unmarkAccountDeletedForRefresh,
  waitForRefreshesToSettle,
  withCloudBundleLock,
} from "@app/self-custodial/recovery-bundle/refresh"
import type { RecoveryBundleSettings } from "@app/self-custodial/recovery-bundle/settings"
import type { RecoveryBundleState } from "@app/self-custodial/recovery-bundle/storage"
import { CloudBackupErrorReason } from "@app/types/cloud-backup"

const ACCOUNT_ID = "acct-1"
const DAY_MS = 24 * 60 * 60 * 1000

/** Lets queued promise callbacks drain, so a test can observe work still
 *  waiting on a lock or on a read it holds open. */
const flushMicrotasks = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve)
  })

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

// State and settings round-trip through in-memory stores, so marks, saves and
// stamps written by one step are what the next step reads.
const stateKeyFor = (accountId: string, network: Network): string =>
  `${accountId}:${network}`
let storedStates = new Map<string, RecoveryBundleState>()
let storedSettings: RecoveryBundleSettings = { autoRefresh: true, cloudSync: true }

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
  storedStates = new Map()
  mockReadRecoveryBundleState.mockImplementation(
    async (accountId: string, network: Network) =>
      storedStates.get(stateKeyFor(accountId, network)) ?? null,
  )
  mockWriteRecoveryBundleState.mockImplementation(
    async (accountId: string, network: Network, state: RecoveryBundleState) => {
      storedStates.set(stateKeyFor(accountId, network), state)
    },
  )
  mockAttemptSilentCloudUpload.mockResolvedValue({ success: true })
  mockAttemptSilentCloudDelete.mockResolvedValue({ success: true })
  mockDeriveIdentityKeyPair.mockImplementation(
    async (_mnemonic: string, network: Network) => ({
      publicKey: Uint8Array.from(
        network === Network.Mainnet ? [0x02, 0xab] : [0x03, 0xcd],
      ),
    }),
  )
  // Cloud sync opted in by default here; the opt-out cases flip it per test.
  storedSettings = { autoRefresh: true, cloudSync: true }
  mockReadRecoveryBundleSettings.mockImplementation(async () => storedSettings)
  mockWriteRecoveryBundleSettings.mockImplementation(
    async (_accountId: string, settings: RecoveryBundleSettings) => {
      storedSettings = settings
    },
  )
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

  describe("coverageKey", () => {
    it("shares the in-flight run with a caller needing the same coverage", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)

      const [first, second] = await Promise.all([
        refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" }),
        refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" }),
      ])

      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)
    })

    /** The in-flight fetch read the leaves before payment B settled, so handing
     *  it to B would drop B's leaves for good: the save stamps savedAt, which
     *  makes the staleness path skip them too. */
    it("reruns for a caller needing newer coverage instead of returning the stale run", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)

      const first = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })
      const second = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-b" })

      expect(second).not.toBe(first)

      await Promise.all([first, second])

      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(2)
    })

    it("serves every mid-run caller with a single rerun rather than one each", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)

      const first = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })
      const second = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-b" })
      const third = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-c" })

      // Both late callers collapse onto the same rerun, so a burst costs one
      // extra pass over the operators, not one per payment.
      expect(third).toBe(second)

      await Promise.all([first, second, third])

      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(2)
    })

    it("reports the rerun's own result to the late caller", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)

      const first = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })
      const second = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-b" })

      const [, secondResult] = await Promise.all([first, second])

      expect(secondResult.success).toBe(true)
    })

    /** A failed run must not strand the caller waiting behind it: the rerun is
     *  chained off settlement, not success. */
    it("still reruns when the in-flight run rejects", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)
      mockFetchRecoveryBundle.mockRejectedValueOnce(new Error("operator down"))

      const first = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })
      const second = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-b" })

      const [firstResult, secondResult] = await Promise.all([first, second])

      expect(firstResult.success).toBe(false)
      expect(secondResult.success).toBe(true)
      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(2)
    })

    /** The staleness sweep names no payment: it only wants a current bundle, so
     *  a run already fetching satisfies it and a second pass over the operators
     *  would buy nothing. */
    it("joins any in-flight run when the caller names no coverage", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)

      const keyed = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })
      const unkeyed = refreshRecoveryBundle(refreshParams)

      expect(unkeyed).toBe(keyed)

      await Promise.all([keyed, unkeyed])

      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(1)
    })

    /** The reverse: a payment arriving during the staleness run does need its
     *  own pass, because that run fetched before the payment settled. */
    it("reruns for a keyed caller arriving during an unkeyed run", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)

      const unkeyed = refreshRecoveryBundle(refreshParams)
      const keyed = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })

      expect(keyed).not.toBe(unkeyed)

      await Promise.all([unkeyed, keyed])

      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(2)
    })

    /** The deletion sweep waits on in-flight work before re-sweeping. A queued
     *  rerun has not started yet but will write once it does, so leaving it out
     *  would let it recreate the deleted account's files after the sweep. */
    it("makes waitForRefreshesToSettle await a queued rerun too", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)

      const first = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })
      const second = refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-b" })

      await waitForRefreshesToSettle(refreshParams.accountId)

      // Both passes are done by the time the sweep is allowed to proceed.
      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(2)
      await Promise.all([first, second])
    })

    it("starts a fresh run once the previous one settled", async () => {
      mockReadBackupStateFor.mockResolvedValue(manualBackupState)

      await refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })
      await refreshRecoveryBundle({ ...refreshParams, coverageKey: "payment-a" })

      // Same key, but nothing is in flight the second time: coalescing must not
      // outlive the run it belonged to.
      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(2)
    })
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

  it("carries the previous cloud record into the saved state and returns the post-sync re-read", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    const priorCloudSyncedAt = 1_752_000_000_000
    const priorBundleCreatedAt = "2026-07-11T00:00:00.000Z"
    storedStates.set(stateKeyFor(ACCOUNT_ID, Network.Mainnet), {
      ...testState,
      bundleCreatedAt: priorBundleCreatedAt,
      cloudSyncedAt: priorCloudSyncedAt,
      cloudSyncedBundleCreatedAt: priorBundleCreatedAt,
    })

    const result = await refreshRecoveryBundle(refreshParams)

    // Exact saved object: the cloud record carries over from the previous
    // state until this bundle's own upload stamps it, and the change marked
    // before the fetch is covered by this save.
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Mainnet,
      {
        savedAt: expect.any(Number),
        bundleCreatedAt: testBundle.createdAt,
        leafCount: 1,
        totalSats: "32768",
        cloudSyncedAt: priorCloudSyncedAt,
        cloudSyncedBundleCreatedAt: priorBundleCreatedAt,
        uncoveredChangeAt: null,
      },
    )
    // The returned state is the re-read after the sync stamped the new bundle
    // (identity, not a structurally similar locally-built object).
    const postSyncState = storedStates.get(stateKeyFor(ACCOUNT_ID, Network.Mainnet))
    expect(postSyncState).toMatchObject({
      cloudSyncedBundleCreatedAt: testBundle.createdAt,
    })
    expect(result).toEqual({ success: true, state: postSyncState })
    if (result.success) expect(result.state).toBe(postSyncState)
  })

  it("returns the state it saved when the re-read after the sync finds none", async () => {
    // The re-read can come back empty when the state is swept between the save
    // and the read; the refresh still succeeded with what it saved.
    mockReadBackupStateFor.mockImplementation(async () => {
      storedStates.clear()
      return manualBackupState
    })

    const result = await refreshRecoveryBundle(refreshParams)

    expect(result).toEqual({
      success: true,
      state: expect.objectContaining({ bundleCreatedAt: testBundle.createdAt }),
    })
  })

  it("resolves { success: false, error } instead of throwing when the fetch rejects", async () => {
    const failure = new Error("operators unreachable")
    mockFetchRecoveryBundle.mockRejectedValue(failure)

    const result = await refreshRecoveryBundle(refreshParams)

    expect(result).toEqual({ success: false, error: failure })
    expect(mockSaveEncryptedBundleFile).not.toHaveBeenCalled()
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("still reports success when the post-save cloud sync step throws", async () => {
    // The bundle and state are already persisted; a failure in the cloud step
    // (here: the settings read inside isCloudSyncAllowedFor) must be recorded
    // separately, not flip the refresh result to failed.
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    const syncFailure = new Error("AsyncStorage unavailable")
    // The only settings read in a refresh happens inside the cloud step
    // (isCloudSyncAllowedFor); rejecting it makes that step throw after the
    // bundle and state were already persisted.
    mockReadRecoveryBundleSettings.mockRejectedValueOnce(syncFailure)

    const result = await refreshRecoveryBundle(refreshParams)

    expect(mockSaveEncryptedBundleFile).toHaveBeenCalledTimes(1)
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.state).toMatchObject({ leafCount: 1, totalSats: "32768" })
    }
    expect(mockRecordAppError).toHaveBeenCalledWith(syncFailure, {
      dedupKey: "recovery-bundle-cloud-sync-step",
    })
  })
})

describe("account deletion vs in-flight refresh", () => {
  // Module-level marker state persists for the process lifetime, so each test
  // uses its own account id.
  it("refuses to start a refresh for a deleted account", async () => {
    const accountId = "acct-deleted-before-start"
    markAccountDeletedForRefresh(accountId)

    const result = await refreshRecoveryBundle({ ...refreshParams, accountId })

    expect(result.success).toBe(false)
    expect(mockFetchRecoveryBundle).not.toHaveBeenCalled()
    expect(mockSaveEncryptedBundleFile).not.toHaveBeenCalled()
  })

  it("does not persist a refresh whose account was deleted mid-fetch", async () => {
    const accountId = "acct-deleted-mid-fetch"
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    let releaseFetch: (bundle: unknown) => void = () => {}
    mockFetchRecoveryBundle.mockReturnValue(
      new Promise((resolve) => {
        releaseFetch = resolve
      }),
    )

    const run = refreshRecoveryBundle({ ...refreshParams, accountId })
    markAccountDeletedForRefresh(accountId)
    releaseFetch(testBundle)
    const result = await run

    expect(result.success).toBe(false)
    expect(mockSaveEncryptedBundleFile).not.toHaveBeenCalled()
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("writes no state for a refresh whose account was deleted right after the file save", async () => {
    const accountId = "acct-deleted-after-save"
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    mockSaveEncryptedBundleFile.mockImplementationOnce(async () => {
      markAccountDeletedForRefresh(accountId)
    })

    const result = await refreshRecoveryBundle({ ...refreshParams, accountId })

    // The file the save left behind is the deletion's re-sweep to remove; the
    // state must not be written for it.
    expect(result).toEqual({ success: false, error: expect.any(Error) })
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("unmarking after the post-deletion re-sweep lets refreshes run again (set stays bounded)", async () => {
    const accountId = "acct-unmarked"
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)

    markAccountDeletedForRefresh(accountId)
    const blocked = await refreshRecoveryBundle({ ...refreshParams, accountId })
    expect(blocked.success).toBe(false)

    unmarkAccountDeletedForRefresh(accountId)
    const allowed = await refreshRecoveryBundle({ ...refreshParams, accountId })
    expect(allowed.success).toBe(true)
    expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(1)
  })

  it("waitForRefreshesToSettle resolves only after the account's in-flight run finishes", async () => {
    const accountId = "acct-settle"
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    let releaseFetch: (bundle: unknown) => void = () => {}
    mockFetchRecoveryBundle.mockReturnValue(
      new Promise((resolve) => {
        releaseFetch = resolve
      }),
    )

    const run = refreshRecoveryBundle({ ...refreshParams, accountId })
    let settled = false
    const settle = waitForRefreshesToSettle(accountId).then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    releaseFetch(testBundle)
    await run
    await settle
    expect(settled).toBe(true)
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

  it("uploads the saved payload and records which bundle it carried", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    mockReadRecoveryBundleState.mockResolvedValue(testState)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(true)
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Mainnet,
      expect.objectContaining({
        cloudSyncedAt: expect.any(Number),
        cloudSyncedBundleCreatedAt: testBundle.createdAt,
      }),
    )
  })

  it("records an app error and returns false when the saved payload no longer parses", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue("corrupt-on-disk")
    mockParseBundleBackupMetadata.mockReturnValue(null)

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockRecordAppError).toHaveBeenCalledWith(expect.any(Error), {
      dedupKey: "recovery-bundle-corrupt-payload",
    })
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("reports failure without stamping cloudSyncedAt when the upload fails", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    mockAttemptSilentCloudUpload.mockResolvedValue({ success: false, reason: "auth" })

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
    // No usable cloud session is a user/device state: expected, never a defect.
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("auth") }),
      { expected: true, dedupKey: "recovery-bundle-cloud-sync" },
    )
  })

  it("records the original error as a defect for an unclassified upload failure", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    const providerError = new Error("iCloud write rejected")
    mockAttemptSilentCloudUpload.mockResolvedValue({
      success: false,
      reason: "unknown",
      error: providerError,
    })

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    // A systemic provider failure must reach the boundary as the original
    // error, unexpected, so it records as a standalone non-fatal.
    expect(mockRecordAppError).toHaveBeenCalledWith(providerError, {
      expected: false,
      dedupKey: "recovery-bundle-cloud-sync",
    })
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("treats a transient network failure as expected, not a defect", async () => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    const networkError = new Error("Drive network error: request timed out")
    mockAttemptSilentCloudUpload.mockResolvedValue({
      success: false,
      reason: "transient",
      error: networkError,
    })

    expect(await syncExistingBundleToCloud(ACCOUNT_ID, Network.Mainnet)).toBe(false)
    // The opening scenario: a dropped connection during the post-payment
    // upload must not file a non-fatal defect for every user on a flaky link.
    expect(mockRecordAppError).toHaveBeenCalledWith(networkError, {
      expected: true,
      dedupKey: "recovery-bundle-cloud-sync",
    })
  })
})

describe("markCloudSynced", () => {
  it("stamps the upload time and the bundle it carried on the existing state", async () => {
    mockReadRecoveryBundleState.mockResolvedValue(testState)

    const next = await markCloudSynced(ACCOUNT_ID, Network.Mainnet, testBundle.createdAt)

    expect(mockReadRecoveryBundleState).toHaveBeenCalledWith(ACCOUNT_ID, Network.Mainnet)
    expect(next).toEqual({
      ...testState,
      cloudSyncedAt: expect.any(Number),
      cloudSyncedBundleCreatedAt: testBundle.createdAt,
    })
    expect(mockWriteRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      Network.Mainnet,
      next,
    )
  })

  it("returns null and writes nothing when no state exists", async () => {
    mockReadRecoveryBundleState.mockResolvedValue(null)

    expect(
      await markCloudSynced(ACCOUNT_ID, Network.Mainnet, testBundle.createdAt),
    ).toBeNull()
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })
})

describe("a refresh that fails leaves the bundle stale", () => {
  // Module-level queues outlive a test, so each test uses its own account id.
  it("keeps a young bundle from reading as fresh after a failed post-payment refresh", async () => {
    const accountId = "acct-stale-failed"
    const key = stateKeyFor(accountId, Network.Mainnet)
    storedStates.set(key, { ...testState, savedAt: Date.now() })
    expect(isBundleFresh(storedStates.get(key) ?? null, Date.now(), DAY_MS)).toBe(true)
    mockFetchRecoveryBundle.mockRejectedValue(new Error("operators unreachable"))

    const result = await refreshRecoveryBundle({ ...refreshParams, accountId })

    // The mark is written before the fetch, so the failure leaves it in place
    // and the bundle saved before the payment no longer reads as fresh.
    expect(result.success).toBe(false)
    expect(storedStates.get(key)?.uncoveredChangeAt).toEqual(expect.any(Number))
    expect(isBundleFresh(storedStates.get(key) ?? null, Date.now(), DAY_MS)).toBe(false)
  })

  it("clears a mark set before the fetch began once the refresh saves", async () => {
    const accountId = "acct-stale-covered"
    const key = stateKeyFor(accountId, Network.Mainnet)
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    storedStates.set(key, { ...testState, uncoveredChangeAt: Date.now() - 1_000 })

    const result = await refreshRecoveryBundle({ ...refreshParams, accountId })

    expect(result.success).toBe(true)
    expect(storedStates.get(key)?.uncoveredChangeAt).toBeNull()
    expect(isBundleFresh(storedStates.get(key) ?? null, Date.now(), DAY_MS)).toBe(true)
  })

  it("keeps a change that landed after the fetch began, from a caller handed that run", async () => {
    const accountId = "acct-stale-late-change"
    const key = stateKeyFor(accountId, Network.Mainnet)
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    storedStates.set(key, { ...testState })
    const fetch = deferred<typeof testBundle>()
    mockFetchRecoveryBundle.mockReturnValue(fetch.promise)
    const clock = jest.spyOn(Date, "now").mockReturnValue(1_000)
    try {
      const run = refreshRecoveryBundle({ ...refreshParams, accountId })
      await flushMicrotasks()
      expect(mockFetchRecoveryBundle).toHaveBeenCalledTimes(1)

      // A payment lands mid-fetch: the caller shares the run, but the run read
      // the leaves before the payment did.
      clock.mockReturnValue(2_000)
      expect(refreshRecoveryBundle({ ...refreshParams, accountId })).toBe(run)
      fetch.resolve(testBundle)
      expect((await run).success).toBe(true)
      await waitForRefreshesToSettle(accountId)

      expect(storedStates.get(key)?.uncoveredChangeAt).toBe(2_000)
      expect(isBundleFresh(storedStates.get(key) ?? null, 2_000, DAY_MS)).toBe(false)
    } finally {
      clock.mockRestore()
    }
  })

  it("reports a failed mark from a caller handed the shared run, without failing the run", async () => {
    const accountId = "acct-stale-mark-fails"
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    const fetch = deferred<typeof testBundle>()
    mockFetchRecoveryBundle.mockReturnValue(fetch.promise)
    const run = refreshRecoveryBundle({ ...refreshParams, accountId })
    await flushMicrotasks()

    const storageDown = new Error("AsyncStorage unavailable")
    mockReadRecoveryBundleState.mockRejectedValueOnce(storageDown)
    refreshRecoveryBundle({ ...refreshParams, accountId })
    await flushMicrotasks()

    expect(mockRecordAppError).toHaveBeenCalledWith(storageDown, {
      dedupKey: "recovery-bundle-stale-mark",
    })
    fetch.resolve(testBundle)
    expect((await run).success).toBe(true)
  })

  it("marks nothing without a saved bundle, which already reads as not fresh", async () => {
    await markRecoveryBundleStale("acct-stale-no-bundle", Network.Mainnet)

    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("clears a mark dated ahead of the clock once a later save covers it", async () => {
    // The device clock moved back after the mark was written: comparing times
    // would keep the bundle stale until the clock caught up again.
    const accountId = "acct-stale-clock-back"
    const key = stateKeyFor(accountId, Network.Mainnet)
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    storedStates.set(key, { ...testState, uncoveredChangeAt: Date.now() + DAY_MS })

    expect((await refreshRecoveryBundle({ ...refreshParams, accountId })).success).toBe(
      true,
    )

    expect(storedStates.get(key)?.uncoveredChangeAt).toBeNull()
  })

  it("keeps a change marked during the first fetch, before any bundle was saved", async () => {
    const accountId = "acct-stale-first-fetch"
    const key = stateKeyFor(accountId, Network.Mainnet)
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    const fetch = deferred<typeof testBundle>()
    mockFetchRecoveryBundle.mockReturnValue(fetch.promise)

    const run = refreshRecoveryBundle({ ...refreshParams, accountId })
    await flushMicrotasks()
    refreshRecoveryBundle({ ...refreshParams, accountId })
    fetch.resolve(testBundle)
    expect((await run).success).toBe(true)
    await waitForRefreshesToSettle(accountId)

    expect(storedStates.get(key)?.uncoveredChangeAt).toEqual(expect.any(Number))
    expect(isBundleFresh(storedStates.get(key) ?? null, Date.now(), DAY_MS)).toBe(false)
  })
})

describe("account deletion vs cloud work", () => {
  beforeEach(() => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
  })

  it("refuses a cloud sync for a deleted account", async () => {
    const accountId = "acct-sync-deleted-before"
    markAccountDeletedForRefresh(accountId)

    expect(await syncExistingBundleToCloud(accountId, Network.Mainnet)).toBe(false)
    expect(mockLoadEncryptedBundleFile).not.toHaveBeenCalled()
  })

  it("does not upload when the account is deleted while the sync reads the bundle", async () => {
    const accountId = "acct-sync-deleted-reading"
    const load = deferred<string | null>()
    mockLoadEncryptedBundleFile.mockReturnValue(load.promise)

    const sync = syncExistingBundleToCloud(accountId, Network.Mainnet)
    await flushMicrotasks()
    markAccountDeletedForRefresh(accountId)
    load.resolve(savedPayload)

    expect(await sync).toBe(false)
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
  })

  it("waits for an upload in flight and drops its stamp once the account is deleted", async () => {
    const accountId = "acct-sync-deleted-uploading"
    const key = stateKeyFor(accountId, Network.Mainnet)
    storedStates.set(key, { ...testState })
    const upload = deferred<{ success: true }>()
    mockAttemptSilentCloudUpload.mockReturnValue(upload.promise)

    const sync = syncExistingBundleToCloud(accountId, Network.Mainnet)
    await flushMicrotasks()
    markAccountDeletedForRefresh(accountId)
    let isSettled = false
    const settle = waitForRefreshesToSettle(accountId).then(() => {
      isSettled = true
    })
    await flushMicrotasks()
    expect(isSettled).toBe(false)

    upload.resolve({ success: true })
    await sync
    await settle
    expect(isSettled).toBe(true)
    expect(storedStates.get(key)).toEqual(testState)
  })

  it("writes no interactive-sync stamp for a deleted account", async () => {
    const accountId = "acct-stamp-deleted-before"
    storedStates.set(stateKeyFor(accountId, Network.Mainnet), { ...testState })
    markAccountDeletedForRefresh(accountId)

    expect(
      await markCloudSynced(accountId, Network.Mainnet, testBundle.createdAt),
    ).toBeNull()
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("drops a stamp whose read was pending when the account was deleted, and waits for it", async () => {
    const accountId = "acct-stamp-deleted-reading"
    const read = deferred<RecoveryBundleState | null>()
    mockReadRecoveryBundleState.mockReturnValueOnce(read.promise)

    const stamp = markCloudSynced(accountId, Network.Mainnet, testBundle.createdAt)
    await flushMicrotasks()
    markAccountDeletedForRefresh(accountId)
    let isSettled = false
    const settle = waitForRefreshesToSettle(accountId).then(() => {
      isSettled = true
    })
    await flushMicrotasks()
    expect(isSettled).toBe(false)

    read.resolve(testState)
    expect(await stamp).toBeNull()
    await settle
    expect(mockWriteRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("skips a cloud operation queued before the deletion mark", async () => {
    const accountId = "acct-lock-deleted-queued"
    const first = deferred<string>()
    const queued = jest.fn(async () => "ran")

    const firstRun = withCloudBundleLock(accountId, Network.Mainnet, () => first.promise)
    const queuedRun = withCloudBundleLock(accountId, Network.Mainnet, queued)
    await flushMicrotasks()
    markAccountDeletedForRefresh(accountId)
    first.resolve("first")

    expect(await firstRun).toBe("first")
    expect(await queuedRun).toBeUndefined()
    expect(queued).not.toHaveBeenCalled()
  })
})

describe("cloud upload ordering", () => {
  const NEWER_BUNDLE_CREATED_AT = "2026-07-13T00:00:00.000Z"
  const newerPayload = JSON.stringify({
    network: "MAINNET",
    walletIdentityPublicKey: testBundle.walletIdentityPublicKey,
    bundleCreatedAt: NEWER_BUNDLE_CREATED_AT,
    encrypted: true,
  })

  beforeEach(() => {
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
  })

  it("stamps the bundle the upload carried, not one saved while it uploaded", async () => {
    const accountId = "acct-order-stamp"
    const key = stateKeyFor(accountId, Network.Mainnet)
    storedStates.set(key, { ...testState })
    const upload = deferred<{ success: true }>()
    mockAttemptSilentCloudUpload.mockReturnValueOnce(upload.promise)

    const sync = syncExistingBundleToCloud(accountId, Network.Mainnet)
    await flushMicrotasks()
    // A refresh saves a newer bundle while the older payload is uploading.
    storedStates.set(key, { ...testState, bundleCreatedAt: NEWER_BUNDLE_CREATED_AT })
    upload.resolve({ success: true })

    expect(await sync).toBe(true)
    expect(storedStates.get(key)).toMatchObject({
      bundleCreatedAt: NEWER_BUNDLE_CREATED_AT,
      cloudSyncedAt: expect.any(Number),
      cloudSyncedBundleCreatedAt: testBundle.createdAt,
    })
  })

  it("starts a second upload only after the first finishes, with the newest payload", async () => {
    const accountId = "acct-order-serial"
    const key = stateKeyFor(accountId, Network.Mainnet)
    storedStates.set(key, { ...testState })
    const firstUpload = deferred<{ success: true }>()
    mockAttemptSilentCloudUpload.mockReturnValueOnce(firstUpload.promise)

    const firstSync = syncExistingBundleToCloud(accountId, Network.Mainnet)
    await flushMicrotasks()
    const secondSync = syncExistingBundleToCloud(accountId, Network.Mainnet)
    await flushMicrotasks()
    expect(mockAttemptSilentCloudUpload).toHaveBeenCalledTimes(1)

    mockLoadEncryptedBundleFile.mockResolvedValue(newerPayload)
    firstUpload.resolve({ success: true })
    expect(await Promise.all([firstSync, secondSync])).toEqual([true, true])

    const uploadedGenerations = mockAttemptSilentCloudUpload.mock.calls.map(
      ([payload]: [string]) => JSON.parse(payload).bundleCreatedAt,
    )
    expect(uploadedGenerations).toEqual([testBundle.createdAt, NEWER_BUNDLE_CREATED_AT])
    expect(storedStates.get(key)?.cloudSyncedBundleCreatedAt).toBe(
      NEWER_BUNDLE_CREATED_AT,
    )
  })

  it("runs the next cloud operation even when the one before it failed", async () => {
    const accountId = "acct-order-after-failure"
    const failure = new Error("provider crashed")

    const failed = withCloudBundleLock(accountId, Network.Mainnet, async () => {
      throw failure
    })
    const next = withCloudBundleLock(accountId, Network.Mainnet, async () => "ran")

    await expect(failed).rejects.toBe(failure)
    expect(await next).toBe("ran")
  })

  it("queues a stamp and a refresh's save so neither reverts the other", async () => {
    const accountId = "acct-order-state"
    const key = stateKeyFor(accountId, Network.Mainnet)
    mockReadBackupStateFor.mockResolvedValue(manualBackupState)
    const priorBundleCreatedAt = "2026-07-11T00:00:00.000Z"
    storedStates.set(key, { ...testState, bundleCreatedAt: priorBundleCreatedAt })
    const stampRead = deferred<RecoveryBundleState | null>()
    mockReadRecoveryBundleState.mockReturnValueOnce(stampRead.promise)

    const stamp = markCloudSynced(accountId, Network.Mainnet, priorBundleCreatedAt)
    const refresh = refreshRecoveryBundle({ ...refreshParams, accountId })
    await flushMicrotasks()
    stampRead.resolve(storedStates.get(key) ?? null)
    await stamp

    expect((await refresh).success).toBe(true)
    expect(storedStates.get(key)).toMatchObject({
      bundleCreatedAt: testBundle.createdAt,
      cloudSyncedAt: expect.any(Number),
      cloudSyncedBundleCreatedAt: priorBundleCreatedAt,
    })
  })
})

describe("revokeCloudRecoveryBundle", () => {
  const MAINNET_FILE = "blink-spark-recovery-bundle-mainnet-02ab.json"
  const REGTEST_FILE = "blink-spark-recovery-bundle-regtest-03cd.json"
  const syncedState = {
    ...testState,
    cloudSyncedAt: 1_752_000_000_000,
    cloudSyncedBundleCreatedAt: testBundle.createdAt,
  }
  const revokeParams = (accountId: string) => ({ accountId, mnemonic: "mnemonic" })

  it("turns cloud sync off, deletes both networks' copies and clears their cloud records", async () => {
    const accountId = "acct-revoke"
    storedStates.set(stateKeyFor(accountId, Network.Mainnet), { ...syncedState })
    storedStates.set(stateKeyFor(accountId, Network.Regtest), { ...syncedState })

    expect(await revokeCloudRecoveryBundle(revokeParams(accountId))).toBe(true)

    expect(storedSettings.cloudSync).toBe(false)
    expect(mockDeriveIdentityKeyPair).toHaveBeenCalledWith("mnemonic", Network.Mainnet)
    expect(mockDeriveIdentityKeyPair).toHaveBeenCalledWith("mnemonic", Network.Regtest)
    expect(mockAttemptSilentCloudDelete).toHaveBeenCalledWith(MAINNET_FILE)
    expect(mockAttemptSilentCloudDelete).toHaveBeenCalledWith(REGTEST_FILE)
    for (const network of [Network.Mainnet, Network.Regtest]) {
      expect(storedStates.get(stateKeyFor(accountId, network))).toMatchObject({
        cloudSyncedAt: null,
        cloudSyncedBundleCreatedAt: null,
      })
    }
  })

  it("fails closed and leaves cloud sync off when one network's delete fails", async () => {
    const accountId = "acct-revoke-delete-fails"
    mockAttemptSilentCloudDelete.mockImplementation(async (fileName: string) =>
      fileName === REGTEST_FILE
        ? { success: false, reason: CloudBackupErrorReason.Transient }
        : { success: true },
    )

    expect(await revokeCloudRecoveryBundle(revokeParams(accountId))).toBe(false)

    // Writing back the value read before the delete could undo a change the
    // user made while it waited, so sync stays off for the user to turn on.
    expect(storedSettings.cloudSync).toBe(false)
    expect(mockWriteRecoveryBundleSettings).toHaveBeenCalledTimes(1)
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("revoke failed: transient"),
      }),
      { expected: true, dedupKey: "recovery-bundle-cloud-revoke" },
    )
  })

  it("fails closed when the wallet identity cannot be derived", async () => {
    const accountId = "acct-revoke-identity-fails"
    const derivationFailure = new Error("invalid mnemonic")
    mockDeriveIdentityKeyPair.mockRejectedValue(derivationFailure)

    expect(await revokeCloudRecoveryBundle(revokeParams(accountId))).toBe(false)

    expect(storedSettings.cloudSync).toBe(false)
    expect(mockAttemptSilentCloudDelete).not.toHaveBeenCalled()
    expect(mockRecordAppError).toHaveBeenCalledWith(derivationFailure, {
      dedupKey: "recovery-bundle-cloud-revoke",
    })
  })

  it("resolves false instead of throwing when the opt-in cannot be read", async () => {
    const settingsFailure = new Error("AsyncStorage unavailable")
    mockReadRecoveryBundleSettings.mockRejectedValueOnce(settingsFailure)

    expect(await revokeCloudRecoveryBundle(revokeParams("acct-revoke-read-fails"))).toBe(
      false,
    )

    expect(mockAttemptSilentCloudDelete).not.toHaveBeenCalled()
    expect(mockRecordAppError).toHaveBeenCalledWith(settingsFailure, {
      dedupKey: "recovery-bundle-cloud-revoke",
    })
  })

  it("refuses a deleted account without touching its settings", async () => {
    const accountId = "acct-revoke-deleted-before"
    markAccountDeletedForRefresh(accountId)

    expect(await revokeCloudRecoveryBundle(revokeParams(accountId))).toBe(false)
    expect(mockWriteRecoveryBundleSettings).not.toHaveBeenCalled()
  })

  it("stops before turning sync off when the account is deleted while the opt-in is read", async () => {
    const accountId = "acct-revoke-deleted-reading"
    const read = deferred<RecoveryBundleSettings>()
    mockReadRecoveryBundleSettings.mockReturnValueOnce(read.promise)

    const revocation = revokeCloudRecoveryBundle(revokeParams(accountId))
    await flushMicrotasks()
    markAccountDeletedForRefresh(accountId)
    read.resolve(storedSettings)

    expect(await revocation).toBe(false)
    expect(mockWriteRecoveryBundleSettings).not.toHaveBeenCalled()
  })

  it("deletes nothing for an account deleted after sync was turned off", async () => {
    const accountId = "acct-revoke-deleted-after-off"
    mockWriteRecoveryBundleSettings.mockImplementationOnce(
      async (_accountId: string, settings: RecoveryBundleSettings) => {
        storedSettings = settings
        markAccountDeletedForRefresh(accountId)
      },
    )

    expect(await revokeCloudRecoveryBundle(revokeParams(accountId))).toBe(false)
    expect(mockWriteRecoveryBundleSettings).toHaveBeenCalledTimes(1)
    expect(mockAttemptSilentCloudDelete).not.toHaveBeenCalled()
  })

  it("lets an upload already running finish first, so the delete leaves the cloud without the bundle", async () => {
    const accountId = "acct-revoke-upload-race"
    const key = stateKeyFor(accountId, Network.Mainnet)
    storedStates.set(key, { ...testState })
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)
    const upload = deferred<{ success: true }>()
    mockAttemptSilentCloudUpload.mockReturnValueOnce(upload.promise)

    const sync = syncExistingBundleToCloud(accountId, Network.Mainnet)
    await flushMicrotasks()
    const revocation = revokeCloudRecoveryBundle(revokeParams(accountId))
    await flushMicrotasks()
    expect(mockAttemptSilentCloudDelete).not.toHaveBeenCalledWith(MAINNET_FILE)

    upload.resolve({ success: true })
    expect(await sync).toBe(true)
    expect(await revocation).toBe(true)

    const [uploadOrder] = mockAttemptSilentCloudUpload.mock.invocationCallOrder
    const mainnetDeleteIndex = mockAttemptSilentCloudDelete.mock.calls.findIndex(
      ([fileName]: [string]) => fileName === MAINNET_FILE,
    )
    const mainnetDeleteOrder =
      mockAttemptSilentCloudDelete.mock.invocationCallOrder[mainnetDeleteIndex]
    expect(uploadOrder).toBeLessThan(mainnetDeleteOrder)
    expect(storedStates.get(key)).toMatchObject({
      cloudSyncedAt: null,
      cloudSyncedBundleCreatedAt: null,
    })
  })

  it("refuses an upload requested once the revocation turned sync off", async () => {
    const accountId = "acct-revoke-then-sync"
    storedStates.set(stateKeyFor(accountId, Network.Mainnet), { ...testState })
    mockReadBackupStateFor.mockResolvedValue(cloudBackupState)
    mockLoadEncryptedBundleFile.mockResolvedValue(savedPayload)

    const revocation = revokeCloudRecoveryBundle(revokeParams(accountId))
    await flushMicrotasks()

    expect(await syncExistingBundleToCloud(accountId, Network.Mainnet)).toBe(false)
    expect(mockAttemptSilentCloudUpload).not.toHaveBeenCalled()
    expect(await revocation).toBe(true)
  })
})

describe("isBundleFresh", () => {
  const MAX_AGE_MS = DAY_MS
  const NOW = 1_752_300_000_000

  const stateSavedAt = (savedAt: number) => ({ ...testState, savedAt })

  it("is false when no state is saved", () => {
    expect(isBundleFresh(null, NOW, MAX_AGE_MS)).toBe(false)
  })

  it("is true when the bundle is younger than the max age", () => {
    expect(isBundleFresh(stateSavedAt(NOW - MAX_AGE_MS + 1), NOW, MAX_AGE_MS)).toBe(true)
  })

  it("is false while a wallet change is uncovered, however young the bundle", () => {
    const youngStateWithChange = { ...stateSavedAt(NOW - 1), uncoveredChangeAt: NOW - 1 }

    expect(isBundleFresh(youngStateWithChange, NOW, MAX_AGE_MS)).toBe(false)
  })

  it("is false exactly at the max age threshold", () => {
    expect(isBundleFresh(stateSavedAt(NOW - MAX_AGE_MS), NOW, MAX_AGE_MS)).toBe(false)
  })

  it("is false when the bundle is older than the max age", () => {
    expect(isBundleFresh(stateSavedAt(NOW - MAX_AGE_MS - 1), NOW, MAX_AGE_MS)).toBe(false)
  })
})
