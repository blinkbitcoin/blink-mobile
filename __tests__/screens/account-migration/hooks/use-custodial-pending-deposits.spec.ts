import { act, renderHook } from "@testing-library/react-native"

import { TxDirection } from "@app/graphql/generated"
import { useCustodialPendingDeposits } from "@app/screens/account-migration/hooks/use-custodial-pending-deposits"

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

  describe("checkClear", () => {
    const checkClearWith = async (refetch: jest.Mock) => {
      mockUseMigrationPendingDepositsQuery.mockReturnValue({
        ...pendingDepositsQueryResult(),
        refetch,
      })
      const { result } = renderHook(() => useCustodialPendingDeposits())
      let isClear: boolean | undefined
      await act(async () => {
        isClear = await result.current.checkClear()
      })
      return isClear
    }

    it("is clear when the fresh answer holds no pending deposit", async () => {
      const refetch = jest
        .fn()
        .mockResolvedValue({ data: pendingDepositsQueryResult().data })

      expect(await checkClearWith(refetch)).toBe(true)
      expect(refetch).toHaveBeenCalledTimes(1)
    })

    it("is not clear when the fresh answer holds a pending deposit", async () => {
      const refetch = jest.fn().mockResolvedValue({
        data: pendingDepositsQueryResult([pendingOnChainReceive]).data,
      })

      expect(await checkClearWith(refetch)).toBe(false)
    })

    it("is not clear when the fresh answer carries no transactions", async () => {
      const refetch = jest.fn().mockResolvedValue({ data: { me: null } })

      expect(await checkClearWith(refetch)).toBe(false)
    })

    it("rejects when the request fails", async () => {
      mockUseMigrationPendingDepositsQuery.mockReturnValue({
        ...pendingDepositsQueryResult(),
        refetch: jest.fn().mockRejectedValue(new Error("network")),
      })
      const { result } = renderHook(() => useCustodialPendingDeposits())

      await expect(result.current.checkClear()).rejects.toThrow("network")
    })
  })
})
