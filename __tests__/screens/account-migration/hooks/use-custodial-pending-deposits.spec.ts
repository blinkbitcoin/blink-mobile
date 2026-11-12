import { act, renderHook } from "@testing-library/react-native"

import { TxDirection } from "@app/graphql/generated"
import { useCustodialPendingDeposits } from "@app/screens/account-migration/hooks/use-custodial-pending-deposits"
import { PendingDepositCheck, PendingDepositCheckStatus } from "@app/types/migration"

import { pendingDepositsQueryResult, pendingOnChainReceive } from "../helpers"

const mockUseMigrationPendingDepositsQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationPendingDepositsQuery: (options: Record<string, unknown>) =>
    mockUseMigrationPendingDepositsQuery(options),
}))

let mockIsAuthed = true
jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

describe("useCustodialPendingDeposits", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
    mockUseMigrationPendingDepositsQuery.mockReturnValue(pendingDepositsQueryResult())
  })

  it("reports a pending deposit for an unconfirmed on-chain receive", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue(
      pendingDepositsQueryResult([pendingOnChainReceive]),
    )

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.hasPendingDeposit).toBe(true)
    expect(result.current.isReady).toBe(true)
  })

  it("reports nothing pending once the list is empty", () => {
    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.hasPendingDeposit).toBe(false)
    expect(result.current.isReady).toBe(true)
    expect(result.current.hasError).toBe(false)
  })

  it("leaves out pending transactions that are not on-chain receives", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue(
      pendingDepositsQueryResult([
        {
          direction: TxDirection.Receive,
          settlementVia: { __typename: "SettlementViaLn" },
        },
        {
          direction: TxDirection.Receive,
          settlementVia: { __typename: "SettlementViaIntraLedger" },
        },
        {
          direction: TxDirection.Send,
          settlementVia: { __typename: "SettlementViaOnChain" },
        },
      ]),
    )

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.hasPendingDeposit).toBe(false)
  })

  describe("a deposit the backend no longer counts", () => {
    const BACKEND_MAX_AGE_SECONDS = 48 * 60 * 60
    const onChainReceiveAged = (ageSeconds: number) => ({
      ...pendingOnChainReceive,
      createdAt: Math.floor(Date.now() / 1000) - ageSeconds,
    })

    it("still counts one just inside the 48 hours", () => {
      mockUseMigrationPendingDepositsQuery.mockReturnValue(
        pendingDepositsQueryResult([onChainReceiveAged(BACKEND_MAX_AGE_SECONDS - 60)]),
      )

      const { result } = renderHook(() => useCustodialPendingDeposits())

      expect(result.current.hasPendingDeposit).toBe(true)
    })

    it("stops counting one older than the 48 hours", () => {
      mockUseMigrationPendingDepositsQuery.mockReturnValue(
        pendingDepositsQueryResult([onChainReceiveAged(BACKEND_MAX_AGE_SECONDS + 60)]),
      )

      const { result } = renderHook(() => useCustodialPendingDeposits())

      expect(result.current.hasPendingDeposit).toBe(false)
    })

    it("lets the check through when the only pending deposit is past the 48 hours", async () => {
      const aged = [onChainReceiveAged(BACKEND_MAX_AGE_SECONDS + 60)]
      mockUseMigrationPendingDepositsQuery.mockReturnValue({
        ...pendingDepositsQueryResult(aged),
        refetch: jest
          .fn()
          .mockResolvedValue({ data: pendingDepositsQueryResult(aged).data }),
      })
      const { result } = renderHook(() => useCustodialPendingDeposits())

      let depositCheck: PendingDepositCheck | undefined
      await act(async () => {
        depositCheck = await result.current.check()
      })

      expect(depositCheck).toEqual({ status: PendingDepositCheckStatus.Clear })
    })
  })

  /** Under errorPolicy "all" a failed check can still carry the last answer, and reading
   *  that as ready would turn a check that failed into "nothing pending". */
  it("is not ready when the check fails, even with an earlier answer still held", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue({
      ...pendingDepositsQueryResult(),
      error: new Error("network"),
    })

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.isReady).toBe(false)
    expect(result.current.hasError).toBe(true)
  })

  it("is not ready while the first answer is in flight", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue({
      loading: true,
      error: undefined,
      data: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.loading).toBe(true)
    expect(result.current.isReady).toBe(false)
  })

  it("keeps the last answer ready while it checks again", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue({
      ...pendingDepositsQueryResult([pendingOnChainReceive]),
      loading: true,
    })

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.loading).toBe(true)
    expect(result.current.isReady).toBe(true)
    expect(result.current.hasPendingDeposit).toBe(true)
  })

  it("never reads a failed query as nothing pending", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue({
      loading: false,
      error: new Error("network"),
      data: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.hasError).toBe(true)
    expect(result.current.isReady).toBe(false)
  })

  it("tells a check that never reached the server apart as a network failure", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue({
      ...pendingDepositsQueryResult(),
      data: undefined,
      error: Object.assign(new Error("Network request failed"), {
        networkError: new Error("offline"),
      }),
    })

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.hasError).toBe(true)
    expect(result.current.hasNetworkFailure).toBe(true)
  })

  it("keeps a check the server answered with an error apart from a network failure", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue({
      ...pendingDepositsQueryResult(),
      data: undefined,
      error: new Error("Not authorized"),
    })

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.hasError).toBe(true)
    expect(result.current.hasNetworkFailure).toBe(false)
  })

  it("is not ready when the query settles without data", () => {
    mockUseMigrationPendingDepositsQuery.mockReturnValue({
      loading: false,
      error: undefined,
      data: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCustodialPendingDeposits())

    expect(result.current.isReady).toBe(false)
    expect(result.current.hasError).toBe(false)
  })

  it("asks the network on every mount and reopens loading for a refetch", () => {
    renderHook(() => useCustodialPendingDeposits())

    expect(mockUseMigrationPendingDepositsQuery).toHaveBeenCalledWith({
      skip: false,
      fetchPolicy: "network-only",
      notifyOnNetworkStatusChange: true,
    })
  })

  it("skips the query for a caller that asks it to", () => {
    renderHook(() => useCustodialPendingDeposits({ skip: true }))

    expect(mockUseMigrationPendingDepositsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("skips the query without a custodial session", () => {
    mockIsAuthed = false

    renderHook(() => useCustodialPendingDeposits())

    expect(mockUseMigrationPendingDepositsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  describe("recheck", () => {
    type CheckAnswer = { data: ReturnType<typeof pendingDepositsQueryResult>["data"] }
    const deferredAnswers = () => {
      const answers: Array<(answer: CheckAnswer) => void> = []
      const refetch = jest.fn().mockImplementation(
        () =>
          new Promise<CheckAnswer>((resolve) => {
            answers.push(resolve)
          }),
      )
      return { refetch, answers }
    }

    it("runs the check and shows it running until it answers", async () => {
      const { refetch, answers } = deferredAnswers()
      mockUseMigrationPendingDepositsQuery.mockReturnValue({
        ...pendingDepositsQueryResult(),
        refetch,
      })
      const { result } = renderHook(() => useCustodialPendingDeposits())
      expect(result.current.isRecheckRunning).toBe(false)

      let depositCheck: Promise<PendingDepositCheck> | undefined
      act(() => {
        depositCheck = result.current.recheck()
      })
      expect(result.current.isRecheckRunning).toBe(true)

      await act(async () => {
        answers[0]({ data: pendingDepositsQueryResult([pendingOnChainReceive]).data })
      })

      expect(result.current.isRecheckRunning).toBe(false)
      expect(await depositCheck).toEqual({ status: PendingDepositCheckStatus.Pending })
    })

    it("keeps showing it running until a second tap's check has answered too", async () => {
      const { refetch, answers } = deferredAnswers()
      mockUseMigrationPendingDepositsQuery.mockReturnValue({
        ...pendingDepositsQueryResult(),
        refetch,
      })
      const { result } = renderHook(() => useCustodialPendingDeposits())

      act(() => {
        result.current.recheck()
        result.current.recheck()
      })
      await act(async () => {
        answers[0]({ data: pendingDepositsQueryResult().data })
      })

      expect(result.current.isRecheckRunning).toBe(true)

      await act(async () => {
        answers[1]({ data: pendingDepositsQueryResult().data })
      })

      expect(result.current.isRecheckRunning).toBe(false)
    })

    describe("whether the user's last check found the deposit still pending", () => {
      const renderWithAnswers = () => {
        const { refetch, answers } = deferredAnswers()
        const queryResult = (transactions: Array<typeof pendingOnChainReceive>) => ({
          ...pendingDepositsQueryResult(transactions),
          refetch,
        })
        mockUseMigrationPendingDepositsQuery.mockReturnValue(
          queryResult([pendingOnChainReceive]),
        )
        const rendered = renderHook(() => useCustodialPendingDeposits())
        const showList = (transactions: Array<typeof pendingOnChainReceive>) => {
          mockUseMigrationPendingDepositsQuery.mockReturnValue(queryResult(transactions))
          rendered.rerender({})
        }
        return { ...rendered, answers, showList }
      }
      const pendingAnswer = () => ({
        data: pendingDepositsQueryResult([pendingOnChainReceive]).data,
      })

      it("is off before the user has checked", () => {
        const { result } = renderWithAnswers()

        expect(result.current.isStillPending).toBe(false)
      })

      it("turns on once the user's check answers pending", async () => {
        const { result, answers } = renderWithAnswers()

        act(() => {
          result.current.recheck()
        })
        await act(async () => {
          answers[0](pendingAnswer())
        })

        expect(result.current.isStillPending).toBe(true)
      })

      it("stays off for a pending answer to a check the user did not start", async () => {
        const { result, answers } = renderWithAnswers()

        act(() => {
          result.current.check()
        })
        await act(async () => {
          answers[0](pendingAnswer())
        })

        expect(result.current.isStillPending).toBe(false)
      })

      it("turns off while the user's next check runs, and stays off when it answers clear", async () => {
        const { result, answers, showList } = renderWithAnswers()
        act(() => {
          result.current.recheck()
        })
        await act(async () => {
          answers[0](pendingAnswer())
        })

        act(() => {
          result.current.recheck()
        })
        expect(result.current.isStillPending).toBe(false)

        showList([])
        await act(async () => {
          answers[1]({ data: pendingDepositsQueryResult().data })
        })

        expect(result.current.isStillPending).toBe(false)
      })

      it("stays off for a check that fails", async () => {
        const refetch = jest.fn().mockRejectedValue(new Error("Network request failed"))
        mockUseMigrationPendingDepositsQuery.mockReturnValue({
          ...pendingDepositsQueryResult([pendingOnChainReceive]),
          refetch,
        })
        const { result } = renderHook(() => useCustodialPendingDeposits())

        await act(async () => {
          await result.current.recheck()
        })

        expect(result.current.isStillPending).toBe(false)
      })

      it("forgets the answer once the deposit has cleared, so a later deposit starts without it", async () => {
        const { result, answers, showList } = renderWithAnswers()
        act(() => {
          result.current.recheck()
        })
        await act(async () => {
          answers[0](pendingAnswer())
        })

        showList([])
        expect(result.current.isStillPending).toBe(false)
        showList([pendingOnChainReceive])

        expect(result.current.isStillPending).toBe(false)
      })

      it("keeps the answer when that same check brings the deposit into the list", async () => {
        const { result, answers, showList } = renderWithAnswers()
        showList([])
        act(() => {
          result.current.recheck()
        })
        await act(async () => {
          answers[0](pendingAnswer())
        })

        showList([pendingOnChainReceive])

        expect(result.current.isStillPending).toBe(true)
      })
    })

    it("leaves the spinner off for a check the user did not start", async () => {
      const { refetch, answers } = deferredAnswers()
      mockUseMigrationPendingDepositsQuery.mockReturnValue({
        ...pendingDepositsQueryResult(),
        refetch,
      })
      const { result } = renderHook(() => useCustodialPendingDeposits())

      act(() => {
        result.current.check()
      })

      expect(result.current.isRecheckRunning).toBe(false)
      await act(async () => {
        answers[0]({ data: pendingDepositsQueryResult().data })
      })
    })
  })

  describe("check", () => {
    const checkWith = async (refetch: jest.Mock) => {
      mockUseMigrationPendingDepositsQuery.mockReturnValue({
        ...pendingDepositsQueryResult(),
        refetch,
      })
      const { result } = renderHook(() => useCustodialPendingDeposits())
      let depositCheck: PendingDepositCheck | undefined
      await act(async () => {
        depositCheck = await result.current.check()
      })
      return depositCheck
    }

    it("is clear when the fresh answer holds no pending deposit", async () => {
      const refetch = jest
        .fn()
        .mockResolvedValue({ data: pendingDepositsQueryResult().data })

      expect(await checkWith(refetch)).toEqual({
        status: PendingDepositCheckStatus.Clear,
      })
      expect(refetch).toHaveBeenCalledTimes(1)
    })

    it("is pending when the fresh answer holds a pending deposit", async () => {
      const refetch = jest.fn().mockResolvedValue({
        data: pendingDepositsQueryResult([pendingOnChainReceive]).data,
      })

      expect(await checkWith(refetch)).toEqual({
        status: PendingDepositCheckStatus.Pending,
      })
    })

    it("is unknown, with no error, when the fresh answer carries no transactions", async () => {
      const refetch = jest.fn().mockResolvedValue({ data: { me: null } })

      expect(await checkWith(refetch)).toEqual({
        status: PendingDepositCheckStatus.Unknown,
        error: null,
      })
    })

    it("is unknown, carrying the request's error, when the request fails", async () => {
      const failure = new Error("network")
      const refetch = jest.fn().mockRejectedValue(failure)

      expect(await checkWith(refetch)).toEqual({
        status: PendingDepositCheckStatus.Unknown,
        error: failure,
      })
    })
  })
})
