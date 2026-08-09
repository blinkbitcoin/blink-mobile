import { act, renderHook } from "@testing-library/react-native"

import { MigrationStatus } from "@app/graphql/generated"
import { MigrationCheckpoint } from "@app/screens/account-migration/utils/migration-checkpoint-storage"
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
let mockMigrationCheckpoint: MigrationCheckpoint | null =
  MigrationCheckpoint.BalancesOverview
const mockSaveCheckpoint = jest.fn()

/** The swap function the hook receives. Its identity can change between renders in
 *  production (a wallet-registry refresh rebuilds it); a test can point it elsewhere to
 *  force the effect to re-run while the first swap is still in flight. */
let mockCompleteMigrationRef: () => Promise<boolean> = mockCompleteMigration

jest.mock("@app/screens/account-migration/hooks/use-complete-migration", () => ({
  useCompleteMigration: () => ({
    migrationCheckpoint: mockMigrationCheckpoint,
    migrationAccountId: mockMigrationAccountId,
    migrationExpectedReceiveSats: 21000,
    migrationLoading: mockMigrationLoading,
    completeMigration: mockCompleteMigrationRef,
    saveCheckpoint: mockSaveCheckpoint,
  }),
}))

/** Confirmed by default so the server phase stays the deciding voice in the existing
 *  cases; the receive-gate cases below flip it. */
let mockReceiveConfirmation = {
  isReceiveConfirmed: true,
  isReceiveDelayed: false,
  isReceiveUnrecoverable: false,
}
const mockUseReceiveConfirmation = jest.fn()

jest.mock(
  "@app/screens/account-migration/hooks/use-migration-receive-confirmation",
  () => ({
    useMigrationReceiveConfirmation: (args: unknown) => {
      mockUseReceiveConfirmation(args)
      return mockReceiveConfirmation
    },
  }),
)

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
    mockMigrationCheckpoint = MigrationCheckpoint.BalancesOverview
    mockSaveCheckpoint.mockResolvedValue(true)
    mockReceiveConfirmation = {
      isReceiveConfirmed: true,
      isReceiveDelayed: false,
      isReceiveUnrecoverable: false,
    }
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

  /** The fix for #4102 covers the relaunch path too: a COMPLETED found at launch must
   *  not swap into a wallet whose funds are still in transit. No swap this session is
   *  fine — the custodial session stays intact and the gate keeps checking. */
  it("holds the swap while the receive is unconfirmed", async () => {
    mockReceiveConfirmation = {
      isReceiveConfirmed: false,
      isReceiveDelayed: false,
      isReceiveUnrecoverable: false,
    }
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).not.toHaveBeenCalled()
  })

  it("finishes the swap once the receive confirms", async () => {
    mockReceiveConfirmation = {
      isReceiveConfirmed: false,
      isReceiveDelayed: false,
      isReceiveUnrecoverable: false,
    }
    const { rerender } = renderHook(() => useResumeCompletedMigration())
    await flushEffects()
    expect(mockCompleteMigration).not.toHaveBeenCalled()

    mockReceiveConfirmation = {
      isReceiveConfirmed: true,
      isReceiveDelayed: false,
      isReceiveUnrecoverable: false,
    }
    rerender({})
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
  })

  /** Each look at the wallet opens a whole SDK connection, so the gate stays off until
   *  the server reports the drain paid out. */
  it("keeps the receive gate off until the server completes", async () => {
    mockStatus = MigrationStatus.Transferring
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockUseReceiveConfirmation).toHaveBeenLastCalledWith({
      selfCustodialAccountId: "sc-account-1",
      expectedReceiveSats: 21000,
      skip: true,
    })
  })

  it("arms the receive gate once the server has completed", async () => {
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockUseReceiveConfirmation).toHaveBeenLastCalledWith({
      selfCustodialAccountId: "sc-account-1",
      expectedReceiveSats: 21000,
      skip: false,
    })
  })

  it("waits for the checkpoint before deciding there is a swap to finish", async () => {
    mockMigrationLoading = true
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).not.toHaveBeenCalled()
  })

  /** This path has no screen of its own to say the wait is unusual, so the crossing is at
   *  least reported rather than leaving a stuck receive invisible. */
  it("reports a receive that has not landed within the notice window", async () => {
    mockReceiveConfirmation = {
      isReceiveConfirmed: false,
      isReceiveDelayed: true,
      isReceiveUnrecoverable: false,
    }
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration resume receive delayed",
      expect.any(Error),
    )
  })

  it("reports the delayed receive once, however often it re-renders", async () => {
    mockReceiveConfirmation = {
      isReceiveConfirmed: false,
      isReceiveDelayed: true,
      isReceiveUnrecoverable: false,
    }
    const { rerender } = renderHook(() => useResumeCompletedMigration())
    await flushEffects()
    rerender({})
    rerender({})
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it("stays quiet while the wait is still inside the notice window", async () => {
    mockReceiveConfirmation = {
      isReceiveConfirmed: false,
      isReceiveDelayed: false,
      isReceiveUnrecoverable: false,
    }
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockReportError).not.toHaveBeenCalled()
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

  /**
   * The gate refuses to confirm a receive whose key it cannot read, which is deliberate —
   * confirming would swap away a working session for a wallet nobody can open. That also
   * means the swap never runs and never resolves false, so this is the only path left to
   * the handover that names the condition.
   */
  describe("when the provisioned wallet's key is gone from the device", () => {
    beforeEach(() => {
      mockReceiveConfirmation = {
        isReceiveConfirmed: false,
        isReceiveDelayed: false,
        isReceiveUnrecoverable: true,
      }
    })

    it("hands the user to support with the reason that names it", async () => {
      renderHook(() => useResumeCompletedMigration())
      await flushEffects()

      expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
        reason: "self-custodial-account-not-on-device",
        origin: "resume",
      })
      expect(mockReportError).toHaveBeenCalledWith(
        "Migration resume without destination account",
        expect.objectContaining({
          message: "Provisioned self-custodial account is not on this device",
        }),
      )
    })

    it("never swaps the session", async () => {
      renderHook(() => useResumeCompletedMigration())
      await flushEffects()

      expect(mockCompleteMigration).not.toHaveBeenCalled()
    })

    it("hands over once however many times the effect re-runs", async () => {
      const { rerender } = renderHook(() => useResumeCompletedMigration())
      await flushEffects()
      rerender({})
      await flushEffects()

      expect(mockNavigate).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * The checkpoint expires 48h after its last write while the receive gate has no bound, so
   * without this a wait spanning two days would lose the record that says there is anything
   * to finish — stranding a funded wallet the switcher also hides.
   */
  describe("keeping the checkpoint alive", () => {
    it("rewrites the stored step once per launch", async () => {
      const { rerender } = renderHook(() => useResumeCompletedMigration())
      await flushEffects()
      rerender({})
      await flushEffects()

      expect(mockSaveCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockSaveCheckpoint).toHaveBeenCalledWith(
        MigrationCheckpoint.BalancesOverview,
      )
    })

    /** No figure of its own, so `mergeCheckpoint` keeps the stored one: this write moves
     *  `savedAt` and nothing else. */
    it("sends no fresh receive figure with it", async () => {
      renderHook(() => useResumeCompletedMigration())
      await flushEffects()

      expect(mockSaveCheckpoint).toHaveBeenCalledWith(expect.anything())
      expect(mockSaveCheckpoint.mock.calls[0]).toHaveLength(1)
    })

    it("writes nothing when there is no migration to finish", async () => {
      mockMigrationCheckpoint = null

      renderHook(() => useResumeCompletedMigration())
      await flushEffects()

      expect(mockSaveCheckpoint).not.toHaveBeenCalled()
    })

    it("waits for the checkpoint to hydrate before rewriting it", async () => {
      mockMigrationLoading = true

      renderHook(() => useResumeCompletedMigration())
      await flushEffects()

      expect(mockSaveCheckpoint).not.toHaveBeenCalled()
    })
  })
})
