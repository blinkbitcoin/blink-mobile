import { act, renderHook } from "@testing-library/react-native"

import { usePendingDepositHold } from "@app/screens/account-migration/hooks/use-pending-deposit-hold"
import { PendingDepositCheckStatus } from "@app/types/migration"

let mockHasPendingDeposit = false
jest.mock("@app/screens/account-migration/hooks/use-custodial-pending-deposits", () => ({
  useCustodialPendingDeposits: () => ({
    hasPendingDeposit: mockHasPendingDeposit,
    isReady: true,
    hasError: false,
    check: jest.fn(),
    recheck: jest.fn().mockResolvedValue({ status: PendingDepositCheckStatus.Clear }),
    isRecheckRunning: false,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-ensure-migration-started", () => ({
  useEnsureMigrationStarted: () => ({
    isStarted: false,
    isRejected: false,
    isDepositPending: false,
    hasConnectionIssue: false,
    retry: jest.fn(),
  }),
}))

/** Figure readings the case answers by hand, in the order they were asked for. */
const deferredRefreshes = () => {
  const answers: Array<(isRefreshed: boolean) => void> = []
  const refreshFigures = jest.fn().mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        answers.push(resolve)
      }),
  )
  return { refreshFigures, answers }
}

describe("usePendingDepositHold reading the figures again", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHasPendingDeposit = false
  })

  const renderHold = (refreshFigures: jest.Mock) =>
    renderHook(() =>
      usePendingDepositHold({
        isStartHeld: false,
        isModalOutranked: false,
        refreshFigures,
        isUndrained: true,
      }),
    )

  it("drops a reading still out when a deposit shows up again, and reads once it clears", async () => {
    const { refreshFigures, answers } = deferredRefreshes()
    mockHasPendingDeposit = true
    const { result, rerender } = renderHold(refreshFigures)
    mockHasPendingDeposit = false
    rerender({})
    expect(refreshFigures).toHaveBeenCalledTimes(1)

    mockHasPendingDeposit = true
    rerender({})
    await act(async () => {
      answers[0](true)
    })

    expect(result.current.figureRefreshes).toBe(0)
    expect(result.current.isBlocking).toBe(true)

    mockHasPendingDeposit = false
    rerender({})
    expect(refreshFigures).toHaveBeenCalledTimes(2)
    await act(async () => {
      answers[1](true)
    })

    expect(result.current.figureRefreshes).toBe(1)
    expect(result.current.isBlocking).toBe(false)
  })

  it("reads again on a retry only once a reading has failed", async () => {
    const { refreshFigures, answers } = deferredRefreshes()
    mockHasPendingDeposit = true
    const { result, rerender } = renderHold(refreshFigures)
    mockHasPendingDeposit = false
    rerender({})

    act(() => {
      result.current.retryFigureRefresh()
    })
    expect(refreshFigures).toHaveBeenCalledTimes(1)

    await act(async () => {
      answers[0](false)
    })
    expect(result.current.hasFigureRefreshFailed).toBe(true)

    act(() => {
      result.current.retryFigureRefresh()
    })

    expect(refreshFigures).toHaveBeenCalledTimes(2)
    expect(result.current.hasFigureRefreshFailed).toBe(false)
  })

  it("never reads the figures again when no deposit has been pending", () => {
    const { refreshFigures } = deferredRefreshes()

    const { result } = renderHold(refreshFigures)

    expect(refreshFigures).not.toHaveBeenCalled()
    expect(result.current.isBlocking).toBe(false)
  })
})
