import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import {
  isCloudBundleStale,
  useStaleCloudBundleBulletin,
} from "@app/self-custodial/hooks/use-stale-cloud-bundle-bulletin"
import type { RecoveryBundleState } from "@app/self-custodial/recovery-bundle/storage"
import { AccountType } from "@app/types/wallet"

const ACCOUNT_ID = "account-1"
const OTHER_ACCOUNT_ID = "account-2"
const NOW = 1_800_000_000_000
const CURRENT_BUNDLE = "2026-10-28T00:00:00.000Z"
const EARLIER_BUNDLE = "2026-10-01T00:00:00.000Z"
/** Not the shipped week, so a pass proves the console's value is the one read. */
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000

const mockUseAccountRegistry = jest.fn()
const mockUseBackupState = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockReadRecoveryBundleState = jest.fn()
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  ...jest.requireActual("@app/self-custodial/providers/backup-state"),
  useBackupState: () => mockUseBackupState(),
}))

jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  readRecoveryBundleState: (...args: unknown[]) => mockReadRecoveryBundleState(...args),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockSparkNetwork.Regtest,
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

// The home re-reads on focus; a plain effect keeps that path exercised without
// a navigation container.
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(callback, [callback]),
}))

const selfCustodialAccount = (id: string) => ({ id, type: AccountType.SelfCustodial })

const cloudBackup = {
  backupState: { status: "completed", method: "cloud", completedMethods: ["cloud"] },
}

const behindForLongEnough = NOW - STALE_AFTER_MS - 1

const bundleState = (over: Partial<RecoveryBundleState> = {}): RecoveryBundleState => ({
  savedAt: NOW - 60_000,
  bundleCreatedAt: CURRENT_BUNDLE,
  leafCount: 2,
  totalSats: "21000",
  cloudSyncedAt: behindForLongEnough,
  cloudSyncedBundleCreatedAt: EARLIER_BUNDLE,
  ...over,
})

const DISMISSAL_KEY = `staleCloudBundleBulletinDismissedFor:regtest:${ACCOUNT_ID}`

describe("isCloudBundleStale", () => {
  it("is not stale while the cloud holds the bundle on this device", () => {
    expect(
      isCloudBundleStale(
        bundleState({ cloudSyncedBundleCreatedAt: CURRENT_BUNDLE }),
        NOW,
        STALE_AFTER_MS,
      ),
    ).toBe(false)
  })

  it("gives a recent upload time to land before calling the cloud behind", () => {
    expect(
      isCloudBundleStale(
        bundleState({ cloudSyncedAt: NOW - 60_000 }),
        NOW,
        STALE_AFTER_MS,
      ),
    ).toBe(false)
  })

  it("calls the cloud behind once its last upload is older than the lag", () => {
    expect(isCloudBundleStale(bundleState(), NOW, STALE_AFTER_MS)).toBe(true)
  })

  it("dates a never-uploaded cloud copy from when the bundle was saved", () => {
    const neverUploaded = { cloudSyncedAt: null, cloudSyncedBundleCreatedAt: null }

    expect(
      isCloudBundleStale(
        bundleState({ ...neverUploaded, savedAt: NOW }),
        NOW,
        STALE_AFTER_MS,
      ),
    ).toBe(false)
    expect(
      isCloudBundleStale(
        bundleState({ ...neverUploaded, savedAt: behindForLongEnough }),
        NOW,
        STALE_AFTER_MS,
      ),
    ).toBe(true)
  })
})

describe("useStaleCloudBundleBulletin", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Date, "now").mockReturnValue(NOW)
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: selfCustodialAccount(ACCOUNT_ID),
    })
    mockUseBackupState.mockReturnValue(cloudBackup)
    mockUseRemoteConfig.mockReturnValue({ cloudBundleStaleAfterMs: STALE_AFTER_MS })
    mockReadRecoveryBundleState.mockResolvedValue(bundleState())
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const renderBulletin = async () => {
    const rendered = renderHook(() => useStaleCloudBundleBulletin())
    await waitFor(() => expect(mockReadRecoveryBundleState).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })
    return rendered
  }

  it("shows when the cloud copy has been behind for too long", async () => {
    const { result } = await renderBulletin()

    expect(mockReadRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      mockSparkNetwork.Regtest,
    )
    expect(mockGetItem).toHaveBeenCalledWith(DISMISSAL_KEY)
    expect(result.current.shouldShow).toBe(true)
  })

  it("waits as long as the console says before calling the cloud behind", async () => {
    mockUseRemoteConfig.mockReturnValue({ cloudBundleStaleAfterMs: 2 * STALE_AFTER_MS })
    const { result } = await renderBulletin()

    expect(result.current.shouldShow).toBe(false)
  })

  it("stays hidden for an account with no cloud backup", async () => {
    mockUseBackupState.mockReturnValue({
      backupState: {
        status: "completed",
        method: "manual",
        completedMethods: ["manual"],
      },
    })
    const { result } = await renderBulletin()

    expect(result.current.shouldShow).toBe(false)
  })

  it("stays hidden while there is no bundle at all", async () => {
    mockReadRecoveryBundleState.mockResolvedValue(null)
    const { result } = await renderBulletin()

    expect(result.current.shouldShow).toBe(false)
  })

  it("stays hidden and reads nothing on a custodial account", async () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "custodial", type: AccountType.Custodial },
    })
    const { result } = renderHook(() => useStaleCloudBundleBulletin())
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockReadRecoveryBundleState).not.toHaveBeenCalled()
    expect(result.current.shouldShow).toBe(false)
  })

  it("stays hidden for the bundle the user dismissed it for", async () => {
    mockGetItem.mockResolvedValue(CURRENT_BUNDLE)
    const { result } = await renderBulletin()

    expect(result.current.shouldShow).toBe(false)
  })

  it("comes back once a newer bundle is saved and the cloud is still behind", async () => {
    mockGetItem.mockResolvedValue(EARLIER_BUNDLE)
    const { result } = await renderBulletin()

    expect(result.current.shouldShow).toBe(true)
  })

  it("hides on dismiss and remembers the bundle it was dismissed for", async () => {
    const { result } = await renderBulletin()

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.shouldShow).toBe(false)
    expect(mockSetItem).toHaveBeenCalledWith(DISMISSAL_KEY, CURRENT_BUNDLE)
  })

  it("reports a dismissal it could not store, and still hides", async () => {
    mockSetItem.mockRejectedValue(new Error("disk full"))
    const { result } = await renderBulletin()

    await act(async () => {
      result.current.dismiss()
    })

    expect(result.current.shouldShow).toBe(false)
    expect(mockReportError).toHaveBeenCalledWith(
      "Stale cloud bundle bulletin dismissal",
      expect.any(Error),
    )
  })

  it("does nothing on dismiss while there is no bundle to dismiss it for", async () => {
    mockReadRecoveryBundleState.mockResolvedValue(null)
    const { result } = await renderBulletin()

    act(() => {
      result.current.dismiss()
    })

    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it("reports a read it could not make and stays hidden", async () => {
    mockReadRecoveryBundleState.mockRejectedValue(new Error("unreadable"))
    const { result } = await renderBulletin()

    expect(mockReportError).toHaveBeenCalledWith(
      "Stale cloud bundle bulletin read",
      expect.any(Error),
    )
    expect(result.current.shouldShow).toBe(false)
  })

  it("keeps the new account's read when the previous account's read lands after it", async () => {
    let releasePrevious: (state: RecoveryBundleState | null) => void = () => {}
    mockReadRecoveryBundleState
      .mockReturnValueOnce(
        new Promise((resolve) => {
          releasePrevious = resolve
        }),
      )
      .mockResolvedValueOnce(null)
    const { result, rerender } = renderHook(() => useStaleCloudBundleBulletin())

    mockUseAccountRegistry.mockReturnValue({
      activeAccount: selfCustodialAccount(OTHER_ACCOUNT_ID),
    })
    rerender({})
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      releasePrevious(bundleState())
    })

    expect(result.current.shouldShow).toBe(false)
  })
})
