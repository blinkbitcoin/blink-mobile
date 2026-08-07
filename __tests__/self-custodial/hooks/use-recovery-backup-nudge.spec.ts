import { renderHook, waitFor, act } from "@testing-library/react-native"

import {
  RecoveryBackupNudgeVariant,
  useRecoveryBackupNudge,
} from "@app/self-custodial/hooks/use-recovery-backup-nudge"
import { RecoveryBundleStatus } from "@app/self-custodial/hooks/use-recovery-bundle-status"

// Matches the convention in use-backup-nudge-state.spec: a bare functional
// mock rather than the storage mock, which is not wired in this environment.
const mockGetItem = jest.fn<Promise<string | null>, [key: string]>()
const mockSetItem = jest.fn().mockResolvedValue(undefined)
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
}))

const mockStatus = jest.fn()
jest.mock("@app/self-custodial/hooks/use-recovery-bundle-status", () => ({
  ...jest.requireActual("@app/self-custodial/hooks/use-recovery-bundle-status"),
  useRecoveryBundleStatus: () => mockStatus(),
}))

const mockAccount = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockAccount() }),
}))

const SAVED_AT = 1_700_000_000_000
const selfCustodial = { id: "account-1", type: "self-custodial" }

const renderNudge = (hasBalance: boolean) =>
  renderHook(() => useRecoveryBackupNudge(hasBalance))

describe("useRecoveryBackupNudge", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
    mockAccount.mockReturnValue(selfCustodial)
    mockStatus.mockReturnValue({
      status: RecoveryBundleStatus.Fresh,
      savedAt: SAVED_AT,
      leafCount: 3,
      isOnlyOnThisDevice: false,
    })
  })

  it("shows nothing while the bundle state is still unknown", async () => {
    mockStatus.mockReturnValue({
      status: RecoveryBundleStatus.Unknown,
      savedAt: null,
      leafCount: null,
      isOnlyOnThisDevice: false,
    })
    const { result } = renderNudge(true)
    await waitFor(() => expect(result.current.variant).toBeNull())
  })

  it("shows nothing on a custodial account", async () => {
    mockAccount.mockReturnValue({ id: "c", type: "custodial" })
    mockStatus.mockReturnValue({
      status: RecoveryBundleStatus.Missing,
      savedAt: null,
      leafCount: null,
      isOnlyOnThisDevice: false,
    })
    const { result } = renderNudge(true)
    await waitFor(() => expect(result.current.variant).toBeNull())
  })

  describe("no backup saved", () => {
    beforeEach(() => {
      mockStatus.mockReturnValue({
        status: RecoveryBundleStatus.Missing,
        savedAt: null,
        leafCount: null,
        isOnlyOnThisDevice: false,
      })
    })

    it("stays quiet on an empty wallet", async () => {
      // Nothing could be backed up yet; this is the ordinary state of a fresh
      // wallet, not a problem to nag about.
      const { result } = renderNudge(false)
      await waitFor(() => expect(result.current.variant).toBeNull())
    })

    it("warns once there are funds with no recovery path", async () => {
      const { result } = renderNudge(true)
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.Missing),
      )
    })

    it("cannot be dismissed away", async () => {
      const { result } = renderNudge(true)
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.Missing),
      )

      result.current.dismiss()

      // Funds with no recovery path is a condition, not a reminder.
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.Missing),
      )
    })
  })

  describe("backup out of date", () => {
    beforeEach(() => {
      mockStatus.mockReturnValue({
        status: RecoveryBundleStatus.Stale,
        savedAt: SAVED_AT,
        leafCount: 3,
        isOnlyOnThisDevice: false,
      })
    })

    it("reminds the user", async () => {
      const { result } = renderNudge(true)
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.Stale),
      )
    })

    it("stays dismissed for the staleness the user saw", async () => {
      mockGetItem.mockResolvedValue(String(SAVED_AT + 1000))
      const { result } = renderNudge(true)
      await waitFor(() => expect(result.current.variant).toBeNull())
    })

    it("returns after the bundle is refreshed and goes stale again", async () => {
      // Dismissal predates the current save, so it covered an older staleness.
      mockGetItem.mockResolvedValue(String(SAVED_AT - 1000))
      const { result } = renderNudge(true)
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.Stale),
      )
    })
  })

  it("stays quiet while the backup is current", async () => {
    const { result } = renderNudge(true)
    await waitFor(() => expect(result.current.variant).toBeNull())
  })

  describe("a bundle that never left the device", () => {
    const onlyHere = (status: RecoveryBundleStatus) => {
      mockStatus.mockReturnValue({
        status,
        savedAt: SAVED_AT,
        leafCount: 3,
        isOnlyOnThisDevice: true,
      })
    }

    it("warns even though the backup is current", async () => {
      // This is the state a user reaches by skipping the export: the bundle is
      // fresh, so neither the missing nor the stale check would fire, yet the
      // only copy dies with the phone.
      onlyHere(RecoveryBundleStatus.Fresh)
      const { result } = renderNudge(true)
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.OnlyOnThisDevice),
      )
    })

    it("takes precedence over staleness", async () => {
      // Both are true; saying both at once says neither well, and having no
      // copy off the device is the bigger problem.
      onlyHere(RecoveryBundleStatus.Stale)
      const { result } = renderNudge(true)
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.OnlyOnThisDevice),
      )
    })

    it("can be dismissed for the bundle the user saw", async () => {
      onlyHere(RecoveryBundleStatus.Fresh)
      mockGetItem.mockResolvedValue(String(SAVED_AT + 1000))
      const { result } = renderNudge(true)
      await waitFor(() => expect(result.current.variant).toBeNull())
    })

    it("returns once the bundle is refreshed and still unexported", async () => {
      onlyHere(RecoveryBundleStatus.Fresh)
      mockGetItem.mockResolvedValue(String(SAVED_AT - 1000))
      const { result } = renderNudge(true)
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.OnlyOnThisDevice),
      )
    })

    it("stays quiet once a copy exists off the device", async () => {
      // Exported by the user, or synced to their cloud - either way there is a
      // second copy and nothing to warn about.
      mockStatus.mockReturnValue({
        status: RecoveryBundleStatus.Fresh,
        savedAt: SAVED_AT,
        leafCount: 3,
        isOnlyOnThisDevice: false,
      })
      const { result } = renderNudge(true)
      await waitFor(() => expect(result.current.variant).toBeNull())
    })
  })

  it("still decides when the dismissal record cannot be read", async () => {
    // An unreadable dismissal must not strand the banner in limbo: treat it as
    // never dismissed and show the warning.
    mockGetItem.mockRejectedValue(new Error("storage unavailable"))
    mockStatus.mockReturnValue({
      status: RecoveryBundleStatus.Stale,
      savedAt: SAVED_AT,
      leafCount: 3,
      isOnlyOnThisDevice: false,
    })
    const { result } = renderNudge(true)
    await waitFor(() =>
      expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.Stale),
    )
  })

  it("ignores a corrupt dismissal value", async () => {
    mockGetItem.mockResolvedValue("not-a-timestamp")
    mockStatus.mockReturnValue({
      status: RecoveryBundleStatus.Stale,
      savedAt: SAVED_AT,
      leafCount: 3,
      isOnlyOnThisDevice: false,
    })
    const { result } = renderNudge(true)
    await waitFor(() =>
      expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.Stale),
    )
  })

  describe("reading and writing the dismissal", () => {
    it("does not set state after the screen is gone", async () => {
      // The read outlives a quick navigation away; writing into an unmounted
      // hook is a warning at best and a leak at worst.
      let releaseRead: (value: string | null) => void = () => {}
      mockGetItem.mockReturnValue(
        new Promise((resolve) => {
          releaseRead = resolve
        }),
      )
      const { unmount } = renderNudge(true)

      unmount()
      await act(async () => {
        releaseRead(String(SAVED_AT))
      })
      // No act() warning and no throw is the assertion; reaching here means the
      // late resolution was ignored.
      expect(mockGetItem).toHaveBeenCalledTimes(1)
    })

    it("still hides the banner when the dismissal cannot be written", async () => {
      // Storage failing is not a reason to keep showing a banner the user just
      // dismissed; it only means it comes back next launch.
      mockSetItem.mockRejectedValue(new Error("disk full"))
      mockStatus.mockReturnValue({
        status: RecoveryBundleStatus.Stale,
        savedAt: SAVED_AT,
        leafCount: 3,
        isOnlyOnThisDevice: false,
      })
      const { result } = renderNudge(true)
      await waitFor(() =>
        expect(result.current.variant).toBe(RecoveryBackupNudgeVariant.Stale),
      )

      await act(async () => {
        result.current.dismiss()
      })

      expect(result.current.variant).toBeNull()
    })

    it("ignores dismissal without an account", async () => {
      mockAccount.mockReturnValue(null)
      const { result } = renderNudge(true)
      await waitFor(() => expect(result.current.variant).toBeNull())

      await act(async () => {
        result.current.dismiss()
      })

      expect(mockSetItem).not.toHaveBeenCalled()
    })
  })
})
