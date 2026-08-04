import { renderHook, waitFor } from "@testing-library/react-native"

import {
  RecoveryBackupNudgeVariant,
  useRecoveryBackupNudge,
} from "@app/hooks/use-recovery-backup-nudge"
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
    })
  })

  it("shows nothing while the bundle state is still unknown", async () => {
    mockStatus.mockReturnValue({
      status: RecoveryBundleStatus.Unknown,
      savedAt: null,
      leafCount: null,
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
})
