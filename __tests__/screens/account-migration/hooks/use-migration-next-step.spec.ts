import { act, renderHook } from "@testing-library/react-native"

import { useMigrationNextStep } from "@app/screens/account-migration/hooks/use-migration-next-step"
import {
  MigrationSupportOrigin,
  MigrationSupportReason,
  ServerMigrationFlow,
} from "@app/types/migration"

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockGoBack = jest.fn()
let mockCanGoBack = true
const mockNavigateToCheckpoint = jest.fn()
const mockReplaceToCheckpoint = jest.fn()
let mockIsAtCommitPoint = false
let mockIsStartConfirmed = false
let mockCheckpointLoading = false
let mockHasTransactions = false
let mockTransactionsLoading = false
let mockFlow: ServerMigrationFlow = ServerMigrationFlow.Open
let mockLockLoading = false
const mockRefetchLock = jest.fn()
let mockIsSupportDue = false
jest.mock("@app/screens/account-migration/utils/migration-receive-wait", () => ({
  ...jest.requireActual("@app/screens/account-migration/utils/migration-receive-wait"),
  isMigrationReceiveSupportDue: () => mockIsSupportDue,
}))

const mockToastShow = jest.fn()
const mockGenericErrorCopy = "There was an error"
const mockFundsOnTheirWayCopy = "Your funds are on their way"

jest.mock("@app/screens/account-migration/hooks/use-migration-lock", () => ({
  useMigrationLock: () => ({
    flow: mockFlow,
    loading: mockLockLoading,
    refetch: mockRefetchLock,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      errors: { generic: () => mockGenericErrorCopy },
      AccountMigration: { transferDelayed: { body: () => mockFundsOnTheirWayCopy } },
    },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
    canGoBack: () => mockCanGoBack,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint", () => ({
  useMigrationCheckpoint: () => ({
    navigateToCheckpoint: mockNavigateToCheckpoint,
    replaceToCheckpoint: mockReplaceToCheckpoint,
    isAtCommitPoint: mockIsAtCommitPoint,
    isStartConfirmed: mockIsStartConfirmed,
    loading: mockCheckpointLoading,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-has-transactions", () => ({
  useHasTransactions: () => ({
    hasTransactions: mockHasTransactions,
    loading: mockTransactionsLoading,
  }),
}))

describe("useMigrationNextStep", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAtCommitPoint = false
    mockIsStartConfirmed = false
    mockCheckpointLoading = false
    mockHasTransactions = false
    mockTransactionsLoading = false
    mockFlow = ServerMigrationFlow.Open
    mockLockLoading = false
    mockCanGoBack = true
    mockIsSupportDue = false
    mockRefetchLock.mockResolvedValue(null)
  })

  it("offers the history download to a fresh migration with history", () => {
    mockHasTransactions = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationDownloadHistory")
    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
  })

  it("skips the download for a fresh migration without history", () => {
    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("returns to the checkpoint when resuming at the commit point even with history", () => {
    mockHasTransactions = true
    mockIsAtCommitPoint = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** A flow left before the commit point replays every step, so the download it already
   *  skipped once is offered again rather than jumped over (#4109). */
  it("offers the history download again to a restarted pre-commit migration", () => {
    mockHasTransactions = true
    mockIsAtCommitPoint = false

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationDownloadHistory")
    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
  })

  /** A screen that skips itself must land where advancing through it would have, or the
   *  history export is silently lost on that path (#4109). */
  it("replaces onto the history download for a skip guard with history", () => {
    mockHasTransactions = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.replaceToNextStep()
    })

    expect(mockReplace).toHaveBeenCalledWith("accountMigrationDownloadHistory")
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("replaces onto the checkpoint for a skip guard without history", () => {
    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.replaceToNextStep()
    })

    expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("replaces onto the checkpoint for a skip guard at the commit point", () => {
    mockHasTransactions = true
    mockIsAtCommitPoint = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.replaceToNextStep()
    })

    expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("reports loading while the transaction check loads", () => {
    mockTransactionsLoading = true

    const { result } = renderHook(() => useMigrationNextStep())

    expect(result.current.loading).toBe(true)
  })

  it("reports loading while the checkpoint loads", () => {
    mockCheckpointLoading = true

    const { result } = renderHook(() => useMigrationNextStep())

    expect(result.current.loading).toBe(true)
  })

  it("continues past the history step to the checkpoint for a fresh migration", () => {
    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.continuePastHistory()
    })

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  describe("a commit point the server has closed", () => {
    /** The device left off on the commit screen after the server accepted the start, and
     *  support has since cleared the flow: the server reads not started. */
    const arriveWithClosedCommitPoint = (): void => {
      mockIsAtCommitPoint = true
      mockIsStartConfirmed = true
      mockFlow = ServerMigrationFlow.NotStarted
    }

    it("starts the flow over instead of returning to the commit screen", () => {
      arriveWithClosedCommitPoint()

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockNavigate).toHaveBeenCalledWith("accountMigrationExplainer")
      expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
    })

    it("does the same for a skip guard, replacing rather than pushing", () => {
      arriveWithClosedCommitPoint()

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.replaceToNextStep()
      })

      expect(mockReplace).toHaveBeenCalledWith("accountMigrationExplainer")
      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    })

    /** The whole detour, not just its first hop: the history step is offered again, and
     *  leaving it starts over rather than resolving the stored step back onto the commit
     *  screen. */
    it("offers the history download again and then starts over, never the commit screen", () => {
      arriveWithClosedCommitPoint()
      mockHasTransactions = true

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })
      act(() => {
        result.current.continuePastHistory()
      })

      expect(mockNavigate).toHaveBeenNthCalledWith(1, "accountMigrationDownloadHistory")
      expect(mockNavigate).toHaveBeenNthCalledWith(2, "accountMigrationExplainer")
      expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
    })
  })

  /** The commit screen records its step before the server accepts the start, which waits
   *  on an emptied dollar balance and can fail. Not started then means not started yet,
   *  so the user returns to the commit screen, which starts it, rather than redoing the
   *  whole flow. */
  describe("a commit point whose start the server never accepted", () => {
    const arriveBeforeTheStart = (): void => {
      mockIsAtCommitPoint = true
      mockIsStartConfirmed = false
      mockFlow = ServerMigrationFlow.NotStarted
    }

    it("returns to the commit screen, skipping the history step", () => {
      arriveBeforeTheStart()
      mockHasTransactions = true

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("does the same for a skip guard", () => {
      arriveBeforeTheStart()

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.replaceToNextStep()
      })

      expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  /**
   * The funds already moved and this device is waiting to swap into the new wallet, which
   * the background resume finishes on its own. Resuming would ask the server to start a
   * migration it already finished and hand the user to support; starting over would drop
   * the figure the swap waits on. The user is told the funds are on their way and stays.
   */
  describe("a completed migration this device has not swapped out of yet", () => {
    const arriveAwaitingSwap = (): void => {
      mockIsAtCommitPoint = true
      mockFlow = ServerMigrationFlow.Completed
    }

    it("says the funds are on their way and neither resumes nor starts over", () => {
      arriveAwaitingSwap()
      mockHasTransactions = true

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: mockFundsOnTheirWayCopy }),
      )
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    it("holds the history step's continue the same way", () => {
      arriveAwaitingSwap()

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.continuePastHistory()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: mockFundsOnTheirWayCopy }),
      )
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
    })

    /** A skip guard renders nothing while it waits to skip, so holding on it would leave a
     *  blank screen: it steps back to the screen that led there instead. */
    it("steps a skip guard back rather than leaving a blank screen", () => {
      arriveAwaitingSwap()

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.replaceToNextStep()
      })

      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockReplace).not.toHaveBeenCalled()
      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    })

    /** Past the notice window, with the app back long enough for a fresh check, the funds
     *  are genuinely late: support takes over instead of another "on its way". */
    it("hands a receive that is genuinely late to support instead", () => {
      arriveAwaitingSwap()
      mockIsSupportDue = true

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
        reason: MigrationSupportReason.ReceiveDelayed,
        origin: MigrationSupportOrigin.Resume,
      })
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("replaces a skip guard with support rather than pushing it", () => {
      arriveAwaitingSwap()
      mockIsSupportDue = true

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.replaceToNextStep()
      })

      expect(mockReplace).toHaveBeenCalledWith("accountMigrationContactSupport", {
        reason: MigrationSupportReason.ReceiveDelayed,
        origin: MigrationSupportOrigin.Resume,
      })
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    it("does not ask the server again, since it already answered", () => {
      arriveAwaitingSwap()

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockRefetchLock).not.toHaveBeenCalled()
    })
  })

  /** No answer, no direction: restarting on a guess would drop the expected receive the
   *  commit point recorded. The tap asks again and says something went wrong, in the
   *  gate's generic wording, since the read can fail for reasons that are not the user's
   *  connection. */
  describe("a commit point the server did not answer for", () => {
    const arriveUnanswered = (): void => {
      mockIsAtCommitPoint = true
      mockFlow = ServerMigrationFlow.Unanswered
    }

    it("asks the server again and explains, without moving", () => {
      arriveUnanswered()
      mockHasTransactions = true

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockRefetchLock).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: mockGenericErrorCopy }),
      )
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
    })

    it("holds the history step's continue the same way", () => {
      arriveUnanswered()

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.continuePastHistory()
      })

      expect(mockRefetchLock).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
    })

    it("asks again and steps a skip guard back rather than leaving a blank screen", () => {
      arriveUnanswered()

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.replaceToNextStep()
      })

      expect(mockRefetchLock).toHaveBeenCalledTimes(1)
      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(mockReplace).not.toHaveBeenCalled()
      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    })

    /** A skip guard renders nothing, so staying put would leave an empty screen. */
    it("sends a skip guard home when there is nowhere to step back to", () => {
      arriveUnanswered()
      mockCanGoBack = false

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.replaceToNextStep()
      })

      expect(mockGoBack).not.toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith("Primary")
      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    })

    /** The status query does not report a refetch as loading, so the button stays live:
     *  repeated taps must not stack requests. */
    it("keeps one re-read in flight however often the user taps", async () => {
      arriveUnanswered()
      let settleRefetch: (value: null) => void = () => undefined
      mockRefetchLock.mockImplementation(
        () =>
          new Promise<null>((resolve) => {
            settleRefetch = resolve
          }),
      )

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
        result.current.goToNextStep()
      })

      expect(mockRefetchLock).toHaveBeenCalledTimes(1)

      await act(async () => {
        settleRefetch(null)
      })
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockRefetchLock).toHaveBeenCalledTimes(2)
    })

    it("frees the next tap to ask again after a re-read that fails", async () => {
      arriveUnanswered()
      mockRefetchLock.mockRejectedValueOnce(new Error("offline"))

      const { result } = renderHook(() => useMigrationNextStep())
      await act(async () => {
        result.current.goToNextStep()
      })
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockRefetchLock).toHaveBeenCalledTimes(2)
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    /** No answer is not a late receive: it asks again, whatever the receive record says. */
    it("never hands an unanswered read to support", () => {
      arriveUnanswered()
      mockIsSupportDue = true

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockRefetchLock).toHaveBeenCalledTimes(1)
    })

    it("walks a flow before the commit point as usual, since only the commit point asks", () => {
      mockFlow = ServerMigrationFlow.Unanswered

      const { result } = renderHook(() => useMigrationNextStep())
      act(() => {
        result.current.goToNextStep()
      })

      expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockRefetchLock).not.toHaveBeenCalled()
    })

    it("waits while the server is still being asked", () => {
      mockIsAtCommitPoint = true
      mockLockLoading = true

      const { result } = renderHook(() => useMigrationNextStep())

      expect(result.current.loading).toBe(true)
    })
  })
})
