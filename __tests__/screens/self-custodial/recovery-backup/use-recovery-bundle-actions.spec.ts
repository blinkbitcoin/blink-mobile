import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act } from "@testing-library/react-native"

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
const mockMarkExported = jest.fn()
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
  markExported: (...args: readonly unknown[]) => mockMarkExported(...args),
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
  mockDecryptBundleBackupPayload.mockResolvedValue({
    schema: 1,
    createdAt: savedState.bundleCreatedAt,
    leaves: [],
  })
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
  mockMarkExported.mockResolvedValue(null)
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
  })

  describe("settings", () => {
    it("exposes the defaults before the first load: auto refresh on, cloud sync off", () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      expect(result.current.settings).toEqual({
        autoRefresh: true,
        cloudSync: false,
      })
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
      expect(result.current.settings).toEqual({
        autoRefresh: false,
        cloudSync: true,
      })
    })
  })

  describe("settings not read yet", () => {
    it("reports the settings as loaded only once this account's own read lands", async () => {
      const { result } = renderHook(() => useRecoveryBundleActions())
      expect(result.current.settingsLoaded).toBe(false)

      await act(async () => {
        await result.current.reloadState()
      })

      expect(result.current.settingsLoaded).toBe(true)
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

    it("reports success when the share sheet completes", async () => {
      const { result } = renderHook(() => useRecoveryBundleActions())

      let didShare: boolean | undefined
      await act(async () => {
        didShare = await result.current.handleShare()
      })

      expect(didShare).toBe(true)
    })

    /** react-native-share rejects with this message when the sheet is
     *  dismissed. It stays silent - a dismissal is a choice, not a failure -
     *  but the caller has to hear about it, or it confirms an export that never
     *  happened. */
    it("reports failure without a toast when the user dismisses the sheet", async () => {
      mockShareOpen.mockRejectedValue(new Error("User did not share"))
      const { result } = renderHook(() => useRecoveryBundleActions())

      let didShare: boolean | undefined
      await act(async () => {
        didShare = await result.current.handleShare()
      })

      expect(didShare).toBe(false)
      expect(mockToastShow).not.toHaveBeenCalled()
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it("reports failure and toasts when the share genuinely fails", async () => {
      mockShareOpen.mockRejectedValue(new Error("no activity found"))
      const { result } = renderHook(() => useRecoveryBundleActions())

      let didShare: boolean | undefined
      await act(async () => {
        didShare = await result.current.handleShare()
      })

      expect(didShare).toBe(false)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Could not export the recovery backup" }),
      )
    })

    it("reports failure when no bundle is saved to export", async () => {
      mockLoadEncryptedBundleFile.mockResolvedValue(null)
      const { result } = renderHook(() => useRecoveryBundleActions())

      let didShare: boolean | undefined
      await act(async () => {
        didShare = await result.current.handleShare()
      })

      expect(didShare).toBe(false)
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
})

describe("useRecoveryBundleActions export record", () => {
  beforeEach(resetMocks)

  it("records the version the share sheet carried once it resolves", async () => {
    const { result } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.handleShare()
    })

    expect(mockMarkExported).toHaveBeenCalledWith(
      ACCOUNT_ID,
      mockSparkNetwork.Regtest,
      savedState.bundleCreatedAt,
    )
    expect(mockWriteRecoveryBundleSettings).not.toHaveBeenCalled()
  })

  it("does not record an export the user cancelled", async () => {
    // A dismissed share sheet is not a copy of anything; counting it would
    // silence the "only on this phone" nudge on a lie.
    mockShareOpen.mockRejectedValueOnce(new Error("User did not share"))
    const { result } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.handleShare()
    })

    expect(mockMarkExported).not.toHaveBeenCalled()
  })

  it("shows the recorded export in the bundle state", async () => {
    const exported = {
      ...savedState,
      exportedBundleCreatedAt: savedState.bundleCreatedAt,
    }
    mockMarkExported.mockResolvedValue(exported)
    const { result } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })

    await act(async () => {
      await result.current.handleShare()
    })

    expect(result.current.bundleState).toEqual(exported)
  })
})

describe("useRecoveryBundleActions error handling", () => {
  beforeEach(resetMocks)

  describe("failure paths", () => {
    it("reloadState degrades to no-bundle when storage throws", async () => {
      // Leaving bundleState undefined would strand the screen on its spinner
      // with no way back; "no bundle yet" still offers a refresh.
      const err = new Error("disk gone")
      mockReadRecoveryBundleState.mockRejectedValue(err)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.reloadState()
      })

      expect(result.current.bundleState).toBeNull()
      expect(mockRecordError).toHaveBeenCalledWith(err)
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

    it("reloadState wraps a non-Error rejection before recording it", async () => {
      mockReadRecoveryBundleState.mockRejectedValue("disk gone")
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.reloadState()
      })

      expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error))
      expect(mockRecordError.mock.calls[0][0].message).toBe("disk gone")
    })

    it("export stops and reports when the seed is not in the keystore", async () => {
      // The bundle is on disk but undecryptable without the seed.
      mockGetMnemonicForAccount.mockResolvedValue(null)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleShare()
      })

      expect(mockDecryptBundleBackupPayload).not.toHaveBeenCalled()
      expect(mockShareOpen).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Could not export the recovery backup" }),
      )
    })

    it("handleShare reports a genuine share failure", async () => {
      const err = new Error("share sheet exploded")
      mockShareOpen.mockRejectedValue(err)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleShare()
      })

      expect(mockRecordError).toHaveBeenCalledWith(err)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Could not export the recovery backup" }),
      )
      expect(result.current.sharing).toBe(false)
    })
  })

  describe("guards", () => {
    const withoutSelfCustodialAccount = () =>
      mockUseAccountRegistry.mockReturnValue({ activeAccount: null })

    it("does nothing without a self-custodial account", async () => {
      // The screen is only reachable from a self-custodial account, but a
      // mid-flight account switch must not export another account's bundle.
      withoutSelfCustodialAccount()
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleShare()
      })

      expect(mockLoadEncryptedBundleFile).not.toHaveBeenCalled()
      expect(mockShareOpen).not.toHaveBeenCalled()
    })

    it("wraps a non-Error failure before recording it", async () => {
      mockShareOpen.mockRejectedValue("not an error object")
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleShare()
      })

      expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error))
      expect(mockRecordError.mock.calls[0][0].message).toBe("not an error object")
    })
  })

  describe("when the settings write fails", () => {
    beforeEach(() => {
      mockWriteRecoveryBundleSettings.mockRejectedValue(new Error("disk full"))
    })

    it("still counts the share as done for the user", async () => {
      // The file left the device whether or not we managed to note it down;
      // failing the export here would tell the user the opposite.
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.handleShare()
      })

      expect(mockShareOpen).toHaveBeenCalled()
      expect(result.current.sharing).toBe(false)
    })
  })

  it("ignores a second share while one is already running", async () => {
    let releaseShare: () => void = () => {}
    mockShareOpen.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseShare = resolve
        }),
    )
    const { result } = renderHook(() => useRecoveryBundleActions())

    let first: Promise<boolean> = Promise.resolve(false)
    await act(async () => {
      first = result.current.handleShare()
    })

    await act(async () => {
      await result.current.handleShare()
    })

    await act(async () => {
      releaseShare()
      await first
    })
    expect(mockShareOpen).toHaveBeenCalledTimes(1)
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
    expect(result.current.settings).toEqual({
      autoRefresh: true,
      cloudSync: false,
    })
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

  it("records an export that finishes after the switch against its own account only", async () => {
    const share = deferred<undefined>()
    mockShareOpen.mockReturnValue(share.promise)
    mockMarkExported.mockResolvedValue({
      ...savedState,
      exportedBundleCreatedAt: savedState.bundleCreatedAt,
    })
    mockReadRecoveryBundleState
      .mockResolvedValueOnce(savedState)
      .mockResolvedValueOnce(otherState)
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })
    let sharing: Promise<boolean> = Promise.resolve(false)
    await act(async () => {
      sharing = result.current.handleShare()
    })

    mockUseAccountRegistry.mockReturnValue({ activeAccount: otherAccount })
    rerender({})
    await act(async () => {
      await result.current.reloadState()
    })
    await act(async () => {
      share.resolve(undefined)
      await sharing
    })

    expect(mockMarkExported).toHaveBeenCalledWith(
      ACCOUNT_ID,
      mockSparkNetwork.Regtest,
      savedState.bundleCreatedAt,
    )
    expect(result.current.bundleState).toEqual(otherState)
  })
})
