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

const mockCopyToClipboard = jest.fn()
const mockUseClipboard = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockRefreshRecoveryBundle = jest.fn()
const mockSyncExistingBundleToCloud = jest.fn()
const mockMarkCloudSynced = jest.fn()
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
  useSparkNetwork: () => mockSparkNetwork.Regtest,
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
  markCloudSynced: (...args: readonly unknown[]) => mockMarkCloudSynced(...args),
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

describe("useRecoveryBundleActions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAccountRegistry.mockReturnValue({ activeAccount: selfCustodialAccount })
    mockGetMnemonicForAccount.mockResolvedValue("test mnemonic words")
    mockReadRecoveryBundleState.mockResolvedValue(savedState)
    mockLoadEncryptedBundleFile.mockResolvedValue("encrypted-payload")
    mockDecryptBundleBackupPayload.mockReturnValue({ schema: 1, leaves: [] })
    // The metadata network deliberately differs from the mocked active network
    // (regtest): the interactive-upload filename must be built from the saved
    // bundle's metadata, not from whatever network the app is currently on.
    mockParseBundleBackupMetadata.mockReturnValue({
      network: "MAINNET",
      walletIdentityPublicKey: "pubkey",
    })
    mockRefreshRecoveryBundle.mockResolvedValue({ success: true, state: savedState })
    mockSyncExistingBundleToCloud.mockResolvedValue(false)
    mockMarkCloudSynced.mockResolvedValue(null)
    mockStartSession.mockResolvedValue({ success: true, session })
    mockUpload.mockResolvedValue({ success: true })
    mockShareOpen.mockResolvedValue(undefined)
  })

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
      expect(mockMarkCloudSynced).toHaveBeenCalledWith(
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
  })

  describe("handleCopy", () => {
    it("requests a 60s clipboard auto-clear so the unencrypted bundle does not linger", () => {
      renderHook(() => useRecoveryBundleActions())

      expect(mockUseClipboard).toHaveBeenCalledWith(60_000)
    })

    it("copies the decrypted bundle JSON to the clipboard", async () => {
      mockDecryptBundleBackupPayload.mockReturnValue({ schema: 1, leafCount: 3 })
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
