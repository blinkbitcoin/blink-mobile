import { act, renderHook } from "@testing-library/react-native"

import { MigrationStatus } from "@app/graphql/generated"
import { useResumeCompletedMigration } from "@app/screens/account-migration/hooks/use-resume-completed-migration"

import { flushEffects } from "../../../helpers/flush-effects"

const mockCompleteMigration = jest.fn()
const mockUseMigrationStatus = jest.fn()
const mockReportError = jest.fn()
const mockNavigate = jest.fn()

/** A single stable object, as React Navigation's own useNavigation returns: a fresh one
 *  per render would change the effect's navigation dependency and re-run it on every
 *  render, which production never does. */
const mockNavigation = { navigate: mockNavigate }

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigation,
}))

let mockStatus: MigrationStatus | null = MigrationStatus.Completed
let mockMigrationAccountId: string | null = "sc-account-1"
let mockMigrationLoading = false

/** The swap function the hook receives. Its identity can change between renders in
 *  production (a wallet-registry refresh rebuilds it); a test can point it elsewhere to
 *  force the effect to re-run while the first swap is still in flight. */
let mockCompleteMigrationRef: () => Promise<boolean> = mockCompleteMigration

jest.mock("@app/screens/account-migration/hooks/use-complete-migration", () => ({
  useCompleteMigration: () => ({
    migrationAccountId: mockMigrationAccountId,
    migrationLoading: mockMigrationLoading,
    completeMigration: mockCompleteMigrationRef,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-status", () => ({
  useMigrationStatus: (options: unknown) => {
    mockUseMigrationStatus(options)
    return { status: mockStatus, loading: false }
  },
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

describe("useResumeCompletedMigration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStatus = MigrationStatus.Completed
    mockMigrationAccountId = "sc-account-1"
    mockMigrationLoading = false
    mockCompleteMigrationRef = mockCompleteMigration
    mockCompleteMigration.mockResolvedValue(true)
  })

  /**
   * The transfer ends in two steps and only the transfer screen watches for the first, so
   * an app killed between them would open on the emptied custodial account with the
   * funded wallet unused in the switcher.
   */
  it("finishes a swap the device never ran", async () => {
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
  })

  it("swaps once per launch, however often it re-renders", async () => {
    const { rerender } = renderHook(() => useResumeCompletedMigration())
    await flushEffects()
    rerender({})
    rerender({})
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
  })

  it("leaves a migration the server has not finished alone", async () => {
    mockStatus = MigrationStatus.Transferring
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).not.toHaveBeenCalled()
  })

  it("waits for the checkpoint before deciding there is a swap to finish", async () => {
    mockMigrationLoading = true
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).not.toHaveBeenCalled()
  })

  /** Nobody who cannot act on the answer should be asking for it on every launch. */
  it("does not ask the server when no checkpoint says a migration is unfinished", async () => {
    mockMigrationAccountId = null
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenCalledWith({ skip: true })
    expect(mockCompleteMigration).not.toHaveBeenCalled()
  })

  it("asks the server when a checkpoint says one is unfinished", async () => {
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenCalledWith({ skip: false })
  })

  /** The funds have already landed, so a transient failure (a briefly locked keystore)
   *  is retried a few times rather than stranding the user, and each attempt is reported. */
  it("retries a throwing swap a bounded number of times", async () => {
    mockCompleteMigration.mockRejectedValue(new Error("keystore locked"))
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(3)
    expect(mockReportError).toHaveBeenLastCalledWith(
      "Migration resume swap",
      expect.objectContaining({ message: "keystore locked" }),
    )
  })

  /** A resolved-true swap is the funds landing on this device: the checkpoint clears and
   *  nobody is sent anywhere. */
  it("does not hand over when the swap succeeds", async () => {
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  /**
   * A swap that resolves false is the reinstall case: the migration finished server-side,
   * but the destination self-custodial account is no longer on this device, so no retry
   * can finish it and the user is handed to support with a reason that names exactly that.
   */
  it("hands over to support when the destination account is not on the device", async () => {
    mockCompleteMigration.mockResolvedValue(false)
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration resume without destination account",
      expect.any(Error),
    )
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "self-custodial-account-not-on-device",
      origin: "resume",
    })
  })

  /** Backing out of support returns to this launch's tree, which re-enters the effect (a
   *  wallet-registry refresh rebuilds completeMigration); the handover is one event, so it
   *  fires once however often the effect re-runs. */
  it("hands over to support only once", async () => {
    mockCompleteMigration.mockResolvedValue(false)
    const secondSwap = jest.fn().mockResolvedValue(false)

    const { rerender } = renderHook(() => useResumeCompletedMigration())
    await flushEffects()
    expect(mockNavigate).toHaveBeenCalledTimes(1)

    mockCompleteMigrationRef = secondSwap
    rerender({})
    await flushEffects()

    expect(secondSwap).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  /** A retry that succeeds stops there: the swap clears the checkpoint, so there is
   *  nothing left to finish. */
  it("stops retrying once a swap succeeds", async () => {
    mockCompleteMigration
      .mockRejectedValueOnce(new Error("keystore locked"))
      .mockImplementationOnce(async () => {
        mockMigrationAccountId = null
        return true
      })
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(2)
  })

  /** The effect can re-run while a swap is still in flight (a wallet-registry refresh
   *  changes completeMigration's identity); the in-flight ref makes that second run a
   *  no-op, so the session is never discarded twice. */
  it("does not start a second swap while one is still in flight", async () => {
    let settle: (value: boolean) => void = () => undefined
    mockCompleteMigration.mockReturnValue(
      new Promise<boolean>((resolve) => {
        settle = resolve
      }),
    )
    const secondSwap = jest.fn().mockResolvedValue(true)

    const { rerender } = renderHook(() => useResumeCompletedMigration())
    await flushEffects()
    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)

    mockCompleteMigrationRef = secondSwap
    rerender({})
    await flushEffects()

    expect(secondSwap).not.toHaveBeenCalled()

    await act(async () => {
      settle(true)
    })
  })
})
