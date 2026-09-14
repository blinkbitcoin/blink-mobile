import { renderHook } from "@testing-library/react-hooks"

jest.mock("@apollo/client", () => {
  const actual = jest.requireActual("@apollo/client")
  return {
    ...actual,
    useApolloClient: jest.fn(),
  }
})

import { useApolloClient } from "@apollo/client"

import {
  TxDirection,
  TxStatus,
  WalletCurrency,
  type TransactionFragment,
} from "@app/graphql/generated"
import { useAccountTransactions } from "@app/hooks/use-account-transactions"

const mockUseApolloClient = useApolloClient as jest.MockedFunction<typeof useApolloClient>

const buildTx = (overrides: Partial<TransactionFragment>): TransactionFragment =>
  ({
    __typename: "Transaction",
    id: "tx-id",
    status: TxStatus.Success,
    createdAt: 1,
    direction: TxDirection.Receive,
    settlementAmount: 1,
    settlementCurrency: WalletCurrency.Btc,
    ...overrides,
  }) as TransactionFragment

describe("useAccountTransactions", () => {
  let mockClient: { readQuery: jest.Mock }

  const renderAccountTransactions = (
    params: Parameters<typeof useAccountTransactions>[0],
  ) => renderHook(() => useAccountTransactions(params))

  beforeEach(() => {
    mockClient = { readQuery: jest.fn() }
    mockUseApolloClient.mockReturnValue(mockClient as never)
  })

  it("returns the provided transactions without touching the cache", () => {
    const provided = [buildTx({ id: "provided" })]

    const { result } = renderAccountTransactions({
      isSelfCustodial: false,
      transactions: provided,
    })

    expect(mockClient.readQuery).not.toHaveBeenCalled()
    expect(result.current).toEqual(provided)
  })

  describe("custodial fallback", () => {
    it("merges the pending and settled transactions the home query cached", () => {
      const pending = buildTx({ id: "pending", status: TxStatus.Pending })
      const settled = buildTx({ id: "settled" })

      mockClient.readQuery.mockReturnValue({
        me: {
          defaultAccount: {
            pendingIncomingTransactions: [pending],
            transactions: { edges: [{ node: settled }] },
          },
        },
      })

      const { result } = renderAccountTransactions({ isSelfCustodial: false })

      expect(result.current.map((tx) => tx.id)).toEqual(["pending", "settled"])
    })

    it("drops an incoming transaction that has not settled yet", () => {
      mockClient.readQuery.mockReturnValue({
        me: {
          defaultAccount: {
            pendingIncomingTransactions: null,
            transactions: {
              edges: [
                { node: buildTx({ id: "settled" }) },
                {
                  node: buildTx({ id: "pending-incoming", status: TxStatus.Pending }),
                },
              ],
            },
          },
        },
      })

      const { result } = renderAccountTransactions({ isSelfCustodial: false })

      expect(result.current.map((tx) => tx.id)).toEqual(["settled"])
    })

    it("keeps an outgoing transaction that has not settled yet", () => {
      mockClient.readQuery.mockReturnValue({
        me: {
          defaultAccount: {
            pendingIncomingTransactions: null,
            transactions: {
              edges: [
                {
                  node: buildTx({
                    id: "pending-send",
                    status: TxStatus.Pending,
                    direction: TxDirection.Send,
                  }),
                },
              ],
            },
          },
        },
      })

      const { result } = renderAccountTransactions({ isSelfCustodial: false })

      expect(result.current.map((tx) => tx.id)).toEqual(["pending-send"])
    })

    it("returns only the pending transactions when the cache has no edges", () => {
      mockClient.readQuery.mockReturnValue({
        me: {
          defaultAccount: {
            pendingIncomingTransactions: [buildTx({ id: "pending-only" })],
            transactions: { edges: [] },
          },
        },
      })

      const { result } = renderAccountTransactions({ isSelfCustodial: false })

      expect(result.current.map((tx) => tx.id)).toEqual(["pending-only"])
    })

    it("returns nothing when the home query was never cached", () => {
      mockClient.readQuery.mockReturnValue(null)

      const { result } = renderAccountTransactions({ isSelfCustodial: false })

      expect(result.current).toEqual([])
    })

    it("falls back when an empty array is provided", () => {
      mockClient.readQuery.mockReturnValue({
        me: {
          defaultAccount: {
            pendingIncomingTransactions: [buildTx({ id: "cached" })],
            transactions: { edges: [] },
          },
        },
      })

      const { result } = renderAccountTransactions({
        isSelfCustodial: false,
        transactions: [],
      })

      expect(result.current.map((tx) => tx.id)).toEqual(["cached"])
    })
  })

  describe("self-custodial account", () => {
    it("never falls back to the custodial cache", () => {
      mockClient.readQuery.mockReturnValue({
        me: {
          defaultAccount: {
            pendingIncomingTransactions: [buildTx({ id: "custodial" })],
            transactions: { edges: [] },
          },
        },
      })

      const { result } = renderAccountTransactions({ isSelfCustodial: true })

      expect(mockClient.readQuery).not.toHaveBeenCalled()
      expect(result.current).toEqual([])
    })

    it("returns the wallet transactions it was handed", () => {
      const provided = [buildTx({ id: "sc-tx" })]

      const { result } = renderAccountTransactions({
        isSelfCustodial: true,
        transactions: provided,
      })

      expect(result.current).toEqual(provided)
    })
  })
})
