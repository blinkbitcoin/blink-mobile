import { act, renderHook } from "@testing-library/react-native"

import { usePendingDepositHold } from "@app/screens/account-migration/hooks/use-pending-deposit-hold"
import { PendingDepositCheckStatus } from "@app/types/migration"

let mockHasPendingDeposit = false
let mockIsStillPending = false
const mockCheck = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-custodial-pending-deposits", () => ({
  useCustodialPendingDeposits: () => ({
    hasPendingDeposit: mockHasPendingDeposit,
    isReady: true,
    hasError: false,
    check: mockCheck,
    recheck: jest.fn().mockResolvedValue({ status: PendingDepositCheckStatus.Clear }),
    isRecheckRunning: false,
    isStillPending: mockIsStillPending,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-support-email", () => ({
  useMigrationSupportEmail: () => ({ sendSupportEmail: jest.fn() }),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-wind-down", () => ({
  useCustodialWindDown: () => null,
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

  const renderHold = (refreshFigures: jest.Mock, isCommitRefusedForDeposit = false) =>
    renderHook(() =>
      usePendingDepositHold({
        isStartHeld: false,
        isModalOutranked: false,
        refreshFigures,
        isUndrained: true,
        isCommitRefusedForDeposit,
        isServerFlowNotStarted: false,
        leaveFlow: jest.fn(),
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

  it("waits for the check after a refused commit before reading the figures again", async () => {
    let answerCheck: () => void = () => undefined
    mockCheck.mockReturnValue(
      new Promise<void>((resolve) => {
        answerCheck = resolve
      }),
    )
    const { refreshFigures } = deferredRefreshes()

    renderHold(refreshFigures, true)

    expect(mockCheck).toHaveBeenCalledTimes(1)
    expect(refreshFigures).not.toHaveBeenCalled()

    await act(async () => {
      answerCheck()
    })

    expect(refreshFigures).toHaveBeenCalledTimes(1)
  })
})

describe("usePendingDepositHold saying the deposit is still confirming", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHasPendingDeposit = true
    mockIsStillPending = true
  })

  const renderHold = (isServerFlowNotStarted: boolean) =>
    renderHook(() =>
      usePendingDepositHold({
        isStartHeld: false,
        isModalOutranked: false,
        refreshFigures: jest.fn().mockResolvedValue(true),
        isUndrained: true,
        isCommitRefusedForDeposit: false,
        isServerFlowNotStarted,
        leaveFlow: jest.fn(),
      }),
    )

  it("says so where OK checks again", () => {
    const { result } = renderHold(false)

    expect(result.current.isModalClosable).toBe(false)
    expect(result.current.isStillPendingShown).toBe(true)
  })

  it("leaves it out where OK only leaves", () => {
    const { result } = renderHold(true)

    expect(result.current.isModalClosable).toBe(true)
    expect(result.current.isStillPendingShown).toBe(false)
  })

  it("leaves it out until the user's check has found the deposit still pending", () => {
    mockIsStillPending = false

    const { result } = renderHold(false)

    expect(result.current.isStillPendingShown).toBe(false)
  })
})
