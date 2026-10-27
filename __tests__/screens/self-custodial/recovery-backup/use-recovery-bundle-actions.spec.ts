import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act } from "@testing-library/react-native"

import {
  RecoveryBundleExportError,
  RecoveryBundleExportErrorReason,
} from "@app/self-custodial/recovery-bundle/exporter"
import type { RecoveryBundleState } from "@app/self-custodial/recovery-bundle/storage"
import { AccountStatus, AccountType } from "@app/types/wallet"

import { useRecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"

const ACCOUNT_ID = "test-self-custodial-uuid"

let mockActiveNetwork = mockSparkNetwork.Regtest

const mockCopyToClipboard = jest.fn()
const mockUseClipboard = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockRefreshRecoveryBundle = jest.fn()
const mockSyncExistingBundleToCloud = jest.fn()
const mockIsCloudSyncAllowedFor = jest.fn()
const mockMarkCloudSynced = jest.fn()
const mockWithCloudBundleLock = jest.fn()
const mockReadRecoveryBundleSettings = jest.fn()
const mockWriteRecoveryBundleSettings = jest.fn()
const mockLoadEncryptedBundleFile = jest.fn()
const mockReadRecoveryBundleState = jest.fn()
const mockDecryptBundleBackupPayload = jest.fn()
const mockParseBundleBackupMetadata = jest.fn()
const mockGetMnemonicForAccount = jest.fn()
const mockStartSession = jest.fn()
const mockUpload = jest.fn()
const mockResolveErrorMessage = jest.fn((reason: string) => `cloud error: ${reason}`)
const mockShareOpen = jest.fn()
const mockToastShow = jest.fn()
const mockRecordError = jest.fn()

jest.mock("react-native-share", () => ({
  open: (...args: readonly unknown[]) => mockShareOpen(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: readonly unknown[]) => mockRecordError(...args),
  log: jest.fn(),
}))

jest.mock("@app/hooks", () => ({
  useClipboard: (...args: readonly unknown[]) => {
    mockUseClipboard(...args)
    return { copyToClipboard: mockCopyToClipboard }
  },
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockActiveNetwork,
}))

jest.mock("@app/self-custodial/config", () => ({
  networkLabelFor: () => "regtest",
}))

// Keep the real filename helpers so the interactive-upload assertions pin the
// production `blink-spark-recovery-bundle-<network>-<pubkey>.json` format
// built from the saved bundle's metadata.
jest.mock("@app/self-custodial/recovery-bundle/cloud", () => {
  const actual = jest.requireActual("@app/self-custodial/recovery-bundle/cloud")
  return {
    getRecoveryBundleFilename: actual.getRecoveryBundleFilename,
    getRecoveryBundleFilenamePrefix: actual.getRecoveryBundleFilenamePrefix,
  }
})

jest.mock("@app/self-custodial/recovery-bundle/encryption", () => ({
  decryptBundleBackupPayload: (...args: readonly unknown[]) =>
    mockDecryptBundleBackupPayload(...args),
  parseBundleBackupMetadata: (...args: readonly unknown[]) =>
    mockParseBundleBackupMetadata(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/refresh", () => ({
  refreshRecoveryBundle: (...args: readonly unknown[]) =>
    mockRefreshRecoveryBundle(...args),
  syncExistingBundleToCloud: (...args: readonly unknown[]) =>
    mockSyncExistingBundleToCloud(...args),
  isCloudSyncAllowedFor: (...args: readonly unknown[]) =>
    mockIsCloudSyncAllowedFor(...args),
  markCloudSynced: (...args: readonly unknown[]) => mockMarkCloudSynced(...args),
  withCloudBundleLock: (...args: readonly unknown[]) => mockWithCloudBundleLock(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/settings", () => ({
  ...jest.requireActual("@app/self-custodial/recovery-bundle/settings"),
  readRecoveryBundleSettings: (...args: readonly unknown[]) =>
    mockReadRecoveryBundleSettings(...args),
  writeRecoveryBundleSettings: (...args: readonly unknown[]) =>
    mockWriteRecoveryBundleSettings(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  loadEncryptedBundleFile: (...args: readonly unknown[]) =>
    mockLoadEncryptedBundleFile(...args),
  readRecoveryBundleState: (...args: readonly unknown[]) =>
    mockReadRecoveryBundleState(...args),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicForAccount: (...args: readonly unknown[]) =>
      mockGetMnemonicForAccount(...args),
  },
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock(
  "@app/screens/self-custodial/onboarding/hooks/use-platform-cloud-backup",
  () => ({
    usePlatformCloudBackup: () => ({
      startSession: mockStartSession,
      upload: mockUpload,
      resolveErrorMessage: mockResolveErrorMessage,
      loading: false,
    }),
  }),
)

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      RecoveryBundleScreen: {
        refreshSuccess: () => "Recovery backup refreshed",
        refreshEmptyWallet: () => "Your wallet is empty, nothing to back up yet",
        refreshFailed: () => "Could not refresh the recovery backup",
        noBundleToExport: () => "No recovery backup saved yet",
        exportFailed: () => "Could not export the recovery backup",
        cloudUploadSuccess: () => "Recovery backup uploaded",
        settingUpdateFailed: () => "Could not save the setting",
      },
    },
  }),
}))

const selfCustodialAccount = {
  id: ACCOUNT_ID,
  type: AccountType.SelfCustodial,
  label: "Spark",
  selected: true,
  status: AccountStatus.Available,
}

const savedState: RecoveryBundleState = {
  savedAt: 1_700_000_000_000,
  bundleCreatedAt: "2023-11-14T22:13:20Z",
  leafCount: 3,
  totalSats: "21000",
  cloudSyncedAt: null,
}

const session = { accessToken: "token", existingFileId: undefined }

const otherAccount = { ...selfCustodialAccount, id: "test-other-self-custodial-uuid" }

const otherState: RecoveryBundleState = {
  ...savedState,
  savedAt: 1_700_000_999_000,
  leafCount: 7,
  totalSats: "5000",
}

const otherSettings = { autoRefresh: false, cloudSync: true }

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: Error) => void = () => {}
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

const resetMocks = () => {
  jest.clearAllMocks()
  mockActiveNetwork = mockSparkNetwork.Regtest
  mockUseAccountRegistry.mockReturnValue({ activeAccount: selfCustodialAccount })
  mockGetMnemonicForAccount.mockResolvedValue("test mnemonic words")
  mockReadRecoveryBundleState.mockResolvedValue(savedState)
  mockLoadEncryptedBundleFile.mockResolvedValue("encrypted-payload")
  mockDecryptBundleBackupPayload.mockResolvedValue({ schema: 1, leaves: [] })
  // The metadata network deliberately differs from the mocked active network
  // (regtest): the interactive-upload filename must be built from the saved
  // bundle's metadata, not from whatever network the app is currently on.
  mockParseBundleBackupMetadata.mockReturnValue({
    network: "MAINNET",
    walletIdentityPublicKey: "pubkey",
    bundleCreatedAt: savedState.bundleCreatedAt,
  })
  mockRefreshRecoveryBundle.mockResolvedValue({ success: true, state: savedState })
  mockSyncExistingBundleToCloud.mockResolvedValue(false)
  mockIsCloudSyncAllowedFor.mockResolvedValue(true)
  mockReadRecoveryBundleSettings.mockResolvedValue({
    autoRefresh: true,
    cloudSync: false,
  })
  mockWriteRecoveryBundleSettings.mockResolvedValue(undefined)
  mockMarkCloudSynced.mockResolvedValue(null)
  mockWithCloudBundleLock.mockImplementation(
    (_accountId: string, _network: string, operation: () => Promise<unknown>) =>
      operation(),
  )
  mockStartSession.mockResolvedValue({ success: true, session })
  mockUpload.mockResolvedValue({ success: true })
  mockShareOpen.mockResolvedValue(undefined)
}

describe("useRecoveryBundleActions", () => {
  beforeEach(resetMocks)

  describe("bundleState / reloadState", () => {
    it("starts with bundleState undefined (loading), distinct from null (no bundle)", () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      expect(result.current.bundleState).toBeUndefined()
      expect(result.current.bundleState).not.toBeNull()
    })

    it("reloadState resolves bundleState to null without touching storage when there is no self-custodial account", async () => {
      mockUseAccountRegistry.mockReturnValue({ activeAccount: null })
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.reloadState()
      })

      expect(result.current.bundleState).toBeNull()
      expect(mockReadRecoveryBundleState).not.toHaveBeenCalled()
    })

    it("reloadState loads the saved state for the active account and network", async () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.reloadState()
      })

      expect(mockReadRecoveryBundleState).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockSparkNetwork.Regtest,
      )
      expect(result.current.bundleState).toEqual(savedState)
    })

    it("degrades to no bundle and keeps the loaded settings when a reload fails", async () => {
      mockReadRecoveryBundleSettings.mockResolvedValue(otherSettings)
      const { result } = renderHook(() => useRecoveryBundleActions())
      await act(async () => {
        await result.current.reloadState()
      })
      mockReadRecoveryBundleState.mockRejectedValue(new Error("unreadable"))

      await act(async () => {
        await result.current.reloadState()
      })

      expect(result.current.bundleState).toBeNull()
      expect(result.current.settings).toEqual(otherSettings)
      expect(mockRecordError).toHaveBeenCalled()
    })
  })

  describe("handleRefresh", () => {
    it("shows a success toast and updates bundleState from the refresh result", async () => {
      const refreshedState = { ...savedState, savedAt: 1_700_000_111_000, leafCount: 5 }
      mockRefreshRecoveryBundle.mockResolvedValue({
        success: true,
        state: refreshedState,
      })
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleRefresh()
      })

      expect(mockRefreshRecoveryBundle).toHaveBeenCalledWith({
        accountId: ACCOUNT_ID,
        network: mockSparkNetwork.Regtest,
        mnemonic: "test mnemonic words",
        appVersion: expect.any(String),
        // A user-initiated refresh carries a coverage key of its own so it can
        // never be served by a run that started before they tapped: a success
        // toast over a bundle missing the balance they just saw is the failure
        // this screen exists to prevent.
        coverageKey: expect.stringMatching(/^manual:\d+$/),
      })
      expect(result.current.bundleState).toEqual(refreshedState)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Recovery backup refreshed",
          type: "success",
        }),
      )
    })

    it("shows the empty-wallet warning copy (not the failure copy) on a NoLeaves export error", async () => {
      mockRefreshRecoveryBundle.mockResolvedValue({
        success: false,
        error: new RecoveryBundleExportError(
          RecoveryBundleExportErrorReason.NoLeaves,
          "wallet has no leaves",
        ),
      })
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleRefresh()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Your wallet is empty, nothing to back up yet",
          type: "warning",
        }),
      )
      expect(mockToastShow).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Could not refresh the recovery backup",
        }),
      )
    })

    it("shows the failure error toast when refresh fails for any other reason", async () => {
      mockRefreshRecoveryBundle.mockResolvedValue({
        success: false,
        error: new RecoveryBundleExportError(
          RecoveryBundleExportErrorReason.IncompleteChain,
          "chain has holes",
        ),
      })
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleRefresh()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Could not refresh the recovery backup",
          type: "error",
        }),
      )
    })

    it("catches an unexpected rejection: records to crashlytics, toasts failure, and resets refreshing", async () => {
      mockRefreshRecoveryBundle.mockRejectedValue(new Error("unexpected boom"))
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await expect(result.current.handleRefresh()).resolves.toBeUndefined()
      })

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "unexpected boom" }),
      )
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Could not refresh the recovery backup" }),
      )
      expect(result.current.refreshing).toBe(false)
    })
  })

  describe("handleCloudUpload", () => {
    it("does nothing when cloud sync is not allowed (opt-out or passwordless seed backup)", async () => {
      mockIsCloudSyncAllowedFor.mockResolvedValue(false)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleCloudUpload()
      })

      // The interactive fallback would bypass the sync path's internal gate,
      // so the action must not reach either upload path (PRD rule D9).
      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
      expect(mockStartSession).not.toHaveBeenCalled()
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it("silent path: reloads state and shows the upload-success toast without an interactive session", async () => {
      mockSyncExistingBundleToCloud.mockResolvedValue(true)
      const synced = { ...savedState, cloudSyncedAt: 1_700_000_222_000 }
      mockReadRecoveryBundleState.mockResolvedValue(synced)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleCloudUpload()
      })

      expect(mockSyncExistingBundleToCloud).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockSparkNetwork.Regtest,
      )
      expect(result.current.bundleState).toEqual(synced)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Recovery backup uploaded",
          type: "success",
        }),
      )
      expect(mockStartSession).not.toHaveBeenCalled()
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it("interactive path: uploads via a session, then markCloudSynced is the single writer of bundleState", async () => {
      mockSyncExistingBundleToCloud.mockResolvedValue(false)
      const synced = { ...savedState, cloudSyncedAt: 1_700_000_333_000 }
      mockMarkCloudSynced.mockResolvedValue(synced)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleCloudUpload()
      })

      // Real production filename, derived from metadata.network ("MAINNET"),
      // not from the active network (regtest).
      expect(mockStartSession).toHaveBeenCalledWith(
        "blink-spark-recovery-bundle-mainnet-pubkey.json",
      )
      expect(mockUpload).toHaveBeenCalledWith(
        "encrypted-payload",
        "blink-spark-recovery-bundle-mainnet-pubkey.json",
        session,
      )
      // The stamp names the bundle this upload carried, which a refresh saving
      // a newer one meanwhile cannot change.
      expect(mockMarkCloudSynced).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockSparkNetwork.Regtest,
        savedState.bundleCreatedAt,
      )
      expect(result.current.bundleState).toEqual(synced)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Recovery backup uploaded",
          type: "success",
        }),
      )
    })

    it("runs the interactive fallback inside the cloud lock for the account and network", async () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleCloudUpload()
      })

      expect(mockWithCloudBundleLock).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockSparkNetwork.Regtest,
        expect.any(Function),
      )
      const lockOrder = mockWithCloudBundleLock.mock.invocationCallOrder[0]
      const sessionOrder = mockStartSession.mock.invocationCallOrder[0]
      expect(lockOrder).toBeLessThan(sessionOrder)
    })

    it("skips the interactive upload when a revocation closed the gate while it waited for the lock", async () => {
      mockIsCloudSyncAllowedFor.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleCloudUpload()
      })

      expect(mockStartSession).not.toHaveBeenCalled()
      expect(mockUpload).not.toHaveBeenCalled()
      expect(mockToastShow).not.toHaveBeenCalled()
      expect(result.current.uploading).toBe(false)
    })

    it("does nothing once the account is deleted and the lock declines to run the upload", async () => {
      mockWithCloudBundleLock.mockResolvedValue(undefined)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleCloudUpload()
      })

      expect(mockStartSession).not.toHaveBeenCalled()
      expect(mockToastShow).not.toHaveBeenCalled()
      expect(result.current.uploading).toBe(false)
    })

    it("catches an unexpected rejection: records to crashlytics, toasts failure, and resets uploading", async () => {
      mockSyncExistingBundleToCloud.mockRejectedValue(new Error("cloud exploded"))
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await expect(result.current.handleCloudUpload()).resolves.toBeUndefined()
      })

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "cloud exploded" }),
      )
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Could not export the recovery backup" }),
      )
      expect(result.current.uploading).toBe(false)
    })
  })

  describe("settings toggles", () => {
    it("exposes the defaults before the first load: auto refresh on, cloud sync off", () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      expect(result.current.settings).toEqual({ autoRefresh: true, cloudSync: false })
    })

    it("reloadState loads the stored settings alongside the bundle state", async () => {
      mockReadRecoveryBundleSettings.mockResolvedValue({
        autoRefresh: false,
        cloudSync: true,
      })
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.reloadState()
      })

      expect(mockReadRecoveryBundleSettings).toHaveBeenCalledWith(ACCOUNT_ID)
      expect(result.current.settings).toEqual({ autoRefresh: false, cloudSync: true })
    })

    it("handleSetAutoRefresh persists the flag for the account", async () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleSetAutoRefresh(false)
      })

      expect(mockWriteRecoveryBundleSettings).toHaveBeenCalledWith(ACCOUNT_ID, {
        autoRefresh: false,
        cloudSync: false,
      })
      expect(result.current.settings.autoRefresh).toBe(false)
      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
    })

    it("handleSetCloudSync(true) persists the opt-in and syncs the existing bundle right away", async () => {
      mockSyncExistingBundleToCloud.mockResolvedValue(true)
      const synced = { ...savedState, cloudSyncedAt: 1_700_000_444_000 }
      mockReadRecoveryBundleState.mockResolvedValue(synced)
      const { result } = renderHook(() => useRecoveryBundleActions())
      // The immediate sync only runs with a loaded bundle state, as on the
      // screen (reloadState fires on focus before the switch is reachable).
      await act(async () => {
        await result.current.reloadState()
      })

      await act(async () => {
        await result.current.handleSetCloudSync(true)
      })

      expect(mockWriteRecoveryBundleSettings).toHaveBeenCalledWith(ACCOUNT_ID, {
        autoRefresh: true,
        cloudSync: true,
      })
      expect(mockSyncExistingBundleToCloud).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockSparkNetwork.Regtest,
      )
      expect(result.current.bundleState).toEqual(synced)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Recovery backup uploaded",
          type: "success",
        }),
      )
    })

    it("handleSetCloudSync(true) falls back to an interactive session when silent sync cannot run", async () => {
      mockSyncExistingBundleToCloud.mockResolvedValue(false)
      const synced = { ...savedState, cloudSyncedAt: 1_700_000_555_000 }
      mockMarkCloudSynced.mockResolvedValue(synced)
      const { result } = renderHook(() => useRecoveryBundleActions())
      await act(async () => {
        await result.current.reloadState()
      })

      await act(async () => {
        await result.current.handleSetCloudSync(true)
      })

      // Same production filename derivation as handleCloudUpload: from the
      // saved bundle's metadata (MAINNET), not the active network (regtest).
      expect(mockStartSession).toHaveBeenCalledWith(
        "blink-spark-recovery-bundle-mainnet-pubkey.json",
      )
      expect(mockUpload).toHaveBeenCalled()
      expect(result.current.bundleState).toEqual(synced)
    })

    it("handleSetCloudSync(true) with no saved bundle persists the opt-in without any upload attempt", async () => {
      mockReadRecoveryBundleState.mockResolvedValue(null)
      const { result } = renderHook(() => useRecoveryBundleActions())
      await act(async () => {
        await result.current.reloadState()
      })

      await act(async () => {
        await result.current.handleSetCloudSync(true)
      })

      expect(mockWriteRecoveryBundleSettings).toHaveBeenCalledWith(ACCOUNT_ID, {
        autoRefresh: true,
        cloudSync: true,
      })
      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
      expect(mockStartSession).not.toHaveBeenCalled()
    })

    it("handleSetCloudSync(false) persists the opt-out without syncing", async () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleSetCloudSync(false)
      })

      expect(mockWriteRecoveryBundleSettings).toHaveBeenCalledWith(ACCOUNT_ID, {
        autoRefresh: true,
        cloudSync: false,
      })
      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
    })

    it("reverts the toggle and toasts when persisting fails", async () => {
      mockWriteRecoveryBundleSettings.mockRejectedValue(new Error("disk full"))
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleSetCloudSync(true)
      })

      expect(result.current.settings.cloudSync).toBe(false)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Could not save the setting" }),
      )
      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
    })
  })

  describe("handleShare", () => {
    it("opens the share sheet with useInternalStorage: true so Android keeps the bundle out of external cache", async () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleShare()
      })

      expect(mockShareOpen).toHaveBeenCalledTimes(1)
      expect(mockShareOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          useInternalStorage: true,
          filename: "blink-recovery-bundle-regtest.json",
          type: "application/json",
          url: expect.stringMatching(/^data:application\/json;base64,/),
        }),
      )
    })

    it("toasts noBundleToExport and never opens the share sheet when no bundle is saved", async () => {
      mockLoadEncryptedBundleFile.mockResolvedValue(null)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleShare()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No recovery backup saved yet" }),
      )
      expect(mockShareOpen).not.toHaveBeenCalled()
      expect(mockDecryptBundleBackupPayload).not.toHaveBeenCalled()
    })

    it("ignores a copy tap while a share export is in flight (one export at a time)", async () => {
      let resolveLoad: (value: string | null) => void = () => {}
      mockLoadEncryptedBundleFile.mockReturnValue(
        new Promise((resolve) => {
          resolveLoad = resolve
        }),
      )
      const { result } = renderHook(() => useRecoveryBundleActions())

      let sharePromise: Promise<void> = Promise.resolve()
      act(() => {
        sharePromise = result.current.handleShare()
      })
      expect(result.current.sharing).toBe(true)
      expect(result.current.copying).toBe(false)

      await act(async () => {
        await result.current.handleCopy()
      })
      expect(mockCopyToClipboard).not.toHaveBeenCalled()

      await act(async () => {
        resolveLoad("encrypted-payload")
        await sharePromise
      })
      expect(result.current.sharing).toBe(false)
    })
  })

  describe("handleCopy", () => {
    it("requests a 60s clipboard auto-clear so the unencrypted bundle does not linger", () => {
      renderHook(() => useRecoveryBundleActions())

      expect(mockUseClipboard).toHaveBeenCalledWith(60_000)
    })

    it("copies the decrypted bundle JSON to the clipboard", async () => {
      mockDecryptBundleBackupPayload.mockResolvedValue({ schema: 1, leafCount: 3 })
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleCopy()
      })

      expect(mockCopyToClipboard).toHaveBeenCalledWith({
        content: JSON.stringify({ schema: 1, leafCount: 3 }, null, 2),
      })
    })

    it("toasts noBundleToExport and never touches the clipboard when no bundle is saved", async () => {
      mockLoadEncryptedBundleFile.mockResolvedValue(null)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleCopy()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No recovery backup saved yet" }),
      )
      expect(mockCopyToClipboard).not.toHaveBeenCalled()
    })
  })
})

describe("useRecoveryBundleActions account switch", () => {
  beforeEach(resetMocks)

  it("keeps the new account's read when the previous account's read lands after it", async () => {
    const previousRead = deferred<RecoveryBundleState | null>()
    mockReadRecoveryBundleState
      .mockReturnValueOnce(previousRead.promise)
      .mockResolvedValueOnce(otherState)
    mockReadRecoveryBundleSettings
      .mockResolvedValueOnce({ autoRefresh: true, cloudSync: false })
      .mockResolvedValueOnce(otherSettings)
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    let previousReload: Promise<void> = Promise.resolve()
    await act(async () => {
      previousReload = result.current.reloadState()
    })

    mockUseAccountRegistry.mockReturnValue({ activeAccount: otherAccount })
    rerender({})
    await act(async () => {
      await result.current.reloadState()
    })
    await act(async () => {
      previousRead.resolve(savedState)
      await previousReload
    })

    expect(result.current.bundleState).toEqual(otherState)
    expect(result.current.settings).toEqual(otherSettings)
  })

  it("reads as loading, with default settings, until the new account's own read lands", async () => {
    mockReadRecoveryBundleSettings.mockResolvedValue(otherSettings)
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })

    mockUseAccountRegistry.mockReturnValue({ activeAccount: otherAccount })
    rerender({})

    expect(result.current.bundleState).toBeUndefined()
    expect(result.current.settings).toEqual({ autoRefresh: true, cloudSync: false })
  })

  it("binds the read to the network too: a network switch reads as loading until it reloads", async () => {
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })

    mockActiveNetwork = mockSparkNetwork.Mainnet
    rerender({})
    expect(result.current.bundleState).toBeUndefined()

    await act(async () => {
      await result.current.reloadState()
    })
    expect(mockReadRecoveryBundleState).toHaveBeenLastCalledWith(
      ACCOUNT_ID,
      mockSparkNetwork.Mainnet,
    )
    expect(result.current.bundleState).toEqual(savedState)
  })

  it("drops a refresh that finishes after the switch", async () => {
    const refresh = deferred<{ success: true; state: RecoveryBundleState }>()
    mockRefreshRecoveryBundle.mockReturnValue(refresh.promise)
    mockReadRecoveryBundleState
      .mockResolvedValueOnce(savedState)
      .mockResolvedValueOnce(otherState)
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })
    let refreshing: Promise<void> = Promise.resolve()
    await act(async () => {
      refreshing = result.current.handleRefresh()
    })

    mockUseAccountRegistry.mockReturnValue({ activeAccount: otherAccount })
    rerender({})
    await act(async () => {
      await result.current.reloadState()
    })
    await act(async () => {
      refresh.resolve({ success: true, state: { ...savedState, leafCount: 9 } })
      await refreshing
    })

    expect(result.current.bundleState).toEqual(otherState)
  })

  it("drops an interactive upload's synced state that lands after the switch", async () => {
    const synced = deferred<RecoveryBundleState | null>()
    mockMarkCloudSynced.mockReturnValue(synced.promise)
    mockReadRecoveryBundleState
      .mockResolvedValueOnce(savedState)
      .mockResolvedValueOnce(otherState)
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })
    let uploading: Promise<void> = Promise.resolve()
    await act(async () => {
      uploading = result.current.handleCloudUpload()
    })

    mockUseAccountRegistry.mockReturnValue({ activeAccount: otherAccount })
    rerender({})
    await act(async () => {
      await result.current.reloadState()
    })
    await act(async () => {
      synced.resolve({ ...savedState, cloudSyncedAt: 1_700_000_777_000 })
      await uploading
    })

    expect(result.current.bundleState).toEqual(otherState)
  })

  it("does not let an upload that outlived the switch reload the previous account", async () => {
    const silentSync = deferred<boolean>()
    mockSyncExistingBundleToCloud.mockReturnValue(silentSync.promise)
    mockReadRecoveryBundleState
      .mockResolvedValueOnce(savedState)
      .mockResolvedValueOnce(otherState)
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })
    let uploading: Promise<void> = Promise.resolve()
    await act(async () => {
      uploading = result.current.handleCloudUpload()
    })

    mockUseAccountRegistry.mockReturnValue({ activeAccount: otherAccount })
    rerender({})
    await act(async () => {
      await result.current.reloadState()
    })
    await act(async () => {
      silentSync.resolve(true)
      await uploading
    })

    expect(mockReadRecoveryBundleState).toHaveBeenCalledTimes(2)
    expect(result.current.bundleState).toEqual(otherState)
  })

  it("keeps the new account's settings when the previous account's write fails after the switch", async () => {
    const write = deferred<undefined>()
    mockWriteRecoveryBundleSettings.mockReturnValue(write.promise)
    mockReadRecoveryBundleSettings
      .mockResolvedValueOnce({ autoRefresh: true, cloudSync: false })
      .mockResolvedValueOnce(otherSettings)
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })
    let toggling: Promise<void> = Promise.resolve()
    await act(async () => {
      toggling = result.current.handleSetAutoRefresh(false)
    })

    mockUseAccountRegistry.mockReturnValue({ activeAccount: otherAccount })
    rerender({})
    await act(async () => {
      await result.current.reloadState()
    })
    await act(async () => {
      write.reject(new Error("disk full"))
      await toggling
    })

    expect(result.current.settings).toEqual(otherSettings)
  })
})
