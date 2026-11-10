import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act } from "@testing-library/react-native"

import type { RecoveryBundleState } from "@app/self-custodial/recovery-bundle/storage"
import { AccountStatus, AccountType } from "@app/types/wallet"

import { useRecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"

const ACCOUNT_ID = "test-self-custodial-uuid"

let mockActiveNetwork = mockSparkNetwork.Regtest

const mockUseAccountRegistry = jest.fn()
const mockLoadEncryptedBundleFile = jest.fn()
const mockReadRecoveryBundleState = jest.fn()
const mockDecryptBundleBackupPayload = jest.fn()
const mockGetMnemonicForAccount = jest.fn()
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

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockActiveNetwork,
}))

jest.mock("@app/self-custodial/config", () => ({
  networkLabelFor: () => "regtest",
}))

jest.mock("@app/self-custodial/recovery-bundle/encryption", () => ({
  decryptBundleBackupPayload: (...args: readonly unknown[]) =>
    mockDecryptBundleBackupPayload(...args),
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

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      RecoveryBundleScreen: {
        noBundleToExport: () => "No emergency bundle yet",
        exportFailed: () => "Could not download the emergency bundle",
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

const otherAccount = { ...selfCustodialAccount, id: "test-other-self-custodial-uuid" }

const otherState: RecoveryBundleState = {
  ...savedState,
  savedAt: 1_700_000_999_000,
  leafCount: 7,
  totalSats: "5000",
}

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
        expect.objectContaining({ message: "Could not download the emergency bundle" }),
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
        expect.objectContaining({ message: "No emergency bundle yet" }),
      )
      expect(mockShareOpen).not.toHaveBeenCalled()
      expect(mockDecryptBundleBackupPayload).not.toHaveBeenCalled()
    })
  })
})

describe("useRecoveryBundleActions error handling", () => {
  beforeEach(resetMocks)

  describe("failure paths", () => {
    it("reloadState degrades to no-bundle when storage throws", async () => {
      // Leaving bundleState undefined would strand the screen on its loading
      // state with no way back.
      const err = new Error("disk gone")
      mockReadRecoveryBundleState.mockRejectedValue(err)
      const { result } = renderHook(() => useRecoveryBundleActions())

      await act(async () => {
        await result.current.reloadState()
      })

      expect(result.current.bundleState).toBeNull()
      expect(mockRecordError).toHaveBeenCalledWith(err)
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
        expect.objectContaining({ message: "Could not download the emergency bundle" }),
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
        expect.objectContaining({ message: "Could not download the emergency bundle" }),
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
  })

  it("reads as loading until the new account's own read lands", async () => {
    const { result, rerender } = renderHook(() => useRecoveryBundleActions())
    await act(async () => {
      await result.current.reloadState()
    })

    mockUseAccountRegistry.mockReturnValue({ activeAccount: otherAccount })
    rerender({})

    expect(result.current.bundleState).toBeUndefined()
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
})
