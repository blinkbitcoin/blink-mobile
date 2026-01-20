import { act, renderHook } from "@testing-library/react-hooks"

jest.mock("@apollo/client", () => {
  const actual = jest.requireActual("@apollo/client")
  return {
    ...actual,
    useApolloClient: jest.fn(),
    gql: jest.fn((literals: TemplateStringsArray, ...placeholders: string[]) =>
      literals.reduce(
        (result, literal, index) => result + literal + (placeholders[index] || ""),
        "",
      ),
    ),
  }
})

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useTxLastSeenQuery: jest.fn(),
  }
})

jest.mock("@app/graphql/client-only-query", () => ({
  markTxLastSeenId: jest.fn(),
}))

import { useTransactionSeenState } from "@app/hooks/use-transaction-seen-state"
import { useApolloClient } from "@apollo/client"
import {
  TxDirection,
  TxStatus,
  WalletCurrency,
  type TransactionFragment,
  useTxLastSeenQuery,
} from "@app/graphql/generated"
import { markTxLastSeenId } from "@app/graphql/client-only-query"

const mockUseApolloClient = useApolloClient as jest.MockedFunction<typeof useApolloClient>
const mockUseTxLastSeenQuery = useTxLastSeenQuery as jest.MockedFunction<
  typeof useTxLastSeenQuery
>
const mockMarkTxLastSeenId = markTxLastSeenId as jest.MockedFunction<
  typeof markTxLastSeenId
>

const buildTx = (overrides: Partial<TransactionFragment>): TransactionFragment =>
  ({
    __typename: "Transaction",
    id: "tx-id",
    status: TxStatus.Success,
    createdAt: 1,
    direction: TxDirection.Receive,
    settlementAmount: 1,
    settlementFee: 0,
    settlementDisplayFee: "",
    settlementCurrency: WalletCurrency.Btc,
    settlementDisplayAmount: "",
    settlementDisplayCurrency: "BTC",
    settlementPrice: {
      __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
      base: 1,
      offset: 0,
      currencyUnit: "BTC",
      formattedAmount: "1",
    },
    initiationVia: {
      __typename: "InitiationViaLn",
      paymentHash: "",
      paymentRequest: "",
    },
    settlementVia: {
      __typename: "SettlementViaLn",
      preImage: null,
    },
    ...overrides,
  }) as TransactionFragment

describe("useTransactionSeenState", () => {
  const accountId = "account-id"
  let mockClient: { readQuery: jest.Mock }

  beforeEach(() => {
    mockClient = { readQuery: jest.fn() }
    mockUseApolloClient.mockReturnValue(mockClient as never)
    mockUseTxLastSeenQuery.mockReturnValue({
      data: { txLastSeen: { btcId: "", usdId: "" } },
    } as never)
    mockMarkTxLastSeenId.mockReset()
  })

  it("derives latest ids from provided transactions", () => {
    mockUseTxLastSeenQuery.mockReturnValue({
      data: { txLastSeen: { btcId: "btc-old", usdId: "usd-old" } },
    } as never)

    const transactions = [
      buildTx({ id: "btc-old", createdAt: 1, settlementCurrency: WalletCurrency.Btc }),
      buildTx({ id: "btc-new", createdAt: 5, settlementCurrency: WalletCurrency.Btc }),
      buildTx({ id: "usd-new", createdAt: 3, settlementCurrency: WalletCurrency.Usd }),
    ]

    const { result } = renderHook(() => useTransactionSeenState(accountId, transactions))

    expect(mockClient.readQuery).not.toHaveBeenCalled()
    expect(result.current.latestBtcTxId).toBe("btc-new")
    expect(result.current.hasUnseenBtcTx).toBe(true)
    expect(result.current.latestUsdTxId).toBe("usd-new")
    expect(result.current.hasUnseenUsdTx).toBe(true)
  })

  it("falls back to cached transactions when empty array is provided", () => {
    const pendingBtc = buildTx({
      id: "pending-btc",
      createdAt: 10,
      settlementCurrency: WalletCurrency.Btc,
      status: TxStatus.Pending,
      direction: TxDirection.Receive,
    })
    const settledUsd = buildTx({
      id: "settled-usd",
      createdAt: 8,
      settlementCurrency: WalletCurrency.Usd,
    })
    const pendingSendUsd = buildTx({
      id: "pending-send-usd",
      createdAt: 5,
      settlementCurrency: WalletCurrency.Usd,
      status: TxStatus.Pending,
      direction: TxDirection.Send,
    })

    mockClient.readQuery.mockReturnValue({
      me: {
        defaultAccount: {
          pendingIncomingTransactions: [pendingBtc],
          transactions: {
            edges: [{ node: settledUsd }, { node: pendingSendUsd }],
          },
        },
      },
    })

    const { result } = renderHook(() => useTransactionSeenState(accountId))

    expect(mockClient.readQuery).toHaveBeenCalledTimes(1)
    expect(result.current.latestBtcTxId).toBe("pending-btc")
    expect(result.current.latestUsdTxId).toBe("settled-usd")
  })

  it("handles transaction arrays", () => {
    const transactions = [
      buildTx({ id: "btc-array", createdAt: 2, settlementCurrency: WalletCurrency.Btc }),
      buildTx({ id: "usd-array", createdAt: 3, settlementCurrency: WalletCurrency.Usd }),
    ]

    const { result } = renderHook(() => useTransactionSeenState(accountId, transactions))

    expect(result.current.latestBtcTxId).toBe("btc-array")
    expect(result.current.latestUsdTxId).toBe("usd-array")
  })

  it("marks the latest transaction as seen for the requested currency", () => {
    const transactions = [
      buildTx({
        id: "btc-to-mark",
        createdAt: 4,
        settlementCurrency: WalletCurrency.Btc,
      }),
    ]

    const { result } = renderHook(() => useTransactionSeenState(accountId, transactions))

    act(() => {
      result.current.markTxSeen(WalletCurrency.Btc)
    })

    expect(mockMarkTxLastSeenId).toHaveBeenCalledWith({
      client: mockClient,
      accountId,
      currency: WalletCurrency.Btc,
      id: "btc-to-mark",
    })
  })
})
