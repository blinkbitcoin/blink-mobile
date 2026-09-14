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

let mockIsSelfCustodial = false

const mockUpdateState = jest.fn()
let mockPersistentState: PersistentState

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

import { useTransactionSeenState } from "@app/hooks/use-transaction-seen-state"
import {
  defaultPersistentState,
  type PersistentState,
} from "@app/store/persistent-state/state-migrations"
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

const SELF_CUSTODIAL_ACCOUNT_ID = "self-custodial-account"

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
    mockIsSelfCustodial = false
    mockUpdateState.mockReset()
    mockPersistentState = {
      ...defaultPersistentState,
      activeAccountId: SELF_CUSTODIAL_ACCOUNT_ID,
    }
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

    const { result } = renderHook(() =>
      useTransactionSeenState({
        accountId,
        isSelfCustodial: mockIsSelfCustodial,
        transactions,
      }),
    )

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

    const { result } = renderHook(() =>
      useTransactionSeenState({ accountId, isSelfCustodial: mockIsSelfCustodial }),
    )

    expect(mockClient.readQuery).toHaveBeenCalledTimes(1)
    expect(result.current.latestBtcTxId).toBe("pending-btc")
    expect(result.current.latestUsdTxId).toBe("settled-usd")
  })

  it("falls back to only the pending transactions when the cache has no edges", () => {
    mockClient.readQuery.mockReturnValue({
      me: {
        defaultAccount: {
          pendingIncomingTransactions: [buildTx({ id: "pending-only", createdAt: 7 })],
          transactions: { edges: [] },
        },
      },
    })

    const { result } = renderHook(() =>
      useTransactionSeenState({ accountId, isSelfCustodial: mockIsSelfCustodial }),
    )

    expect(result.current.latestBtcTxId).toBe("pending-only")
  })

  it("falls back to only the settled transactions when nothing is pending", () => {
    mockClient.readQuery.mockReturnValue({
      me: {
        defaultAccount: {
          pendingIncomingTransactions: null,
          transactions: {
            edges: [{ node: buildTx({ id: "settled-only", createdAt: 6 }) }],
          },
        },
      },
    })

    const { result } = renderHook(() =>
      useTransactionSeenState({ accountId, isSelfCustodial: mockIsSelfCustodial }),
    )

    expect(result.current.latestBtcTxId).toBe("settled-only")
  })

  it("handles transaction arrays", () => {
    const transactions = [
      buildTx({ id: "btc-array", createdAt: 2, settlementCurrency: WalletCurrency.Btc }),
      buildTx({ id: "usd-array", createdAt: 3, settlementCurrency: WalletCurrency.Usd }),
    ]

    const { result } = renderHook(() =>
      useTransactionSeenState({
        accountId,
        isSelfCustodial: mockIsSelfCustodial,
        transactions,
      }),
    )

    expect(result.current.latestBtcTxId).toBe("btc-array")
    expect(result.current.latestUsdTxId).toBe("usd-array")
  })

  it("runs the last-seen query for the custodial account it is keyed by", () => {
    renderHook(() =>
      useTransactionSeenState({ accountId, isSelfCustodial: mockIsSelfCustodial }),
    )

    expect(mockUseTxLastSeenQuery).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { accountId }, skip: false }),
    )
  })

  it("marks the latest transaction as seen for the requested currency", () => {
    const transactions = [
      buildTx({
        id: "btc-to-mark",
        createdAt: 4,
        settlementCurrency: WalletCurrency.Btc,
      }),
    ]

    const { result } = renderHook(() =>
      useTransactionSeenState({
        accountId,
        isSelfCustodial: mockIsSelfCustodial,
        transactions,
      }),
    )

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

  describe("self-custodial account", () => {
    const btcTx = buildTx({
      id: "sc-btc",
      createdAt: 4,
      settlementCurrency: WalletCurrency.Btc,
    })
    const usdTx = buildTx({
      id: "sc-usd",
      createdAt: 3,
      settlementCurrency: WalletCurrency.Usd,
    })

    beforeEach(() => {
      mockIsSelfCustodial = true
    })

    it("reads the seen state from the device, not the Apollo cache", () => {
      mockUseTxLastSeenQuery.mockReturnValue({
        data: { txLastSeen: { btcId: "sc-btc", usdId: "sc-usd" } },
      } as never)
      mockPersistentState = {
        ...defaultPersistentState,
        activeAccountId: SELF_CUSTODIAL_ACCOUNT_ID,
        txLastSeenByAccountId: {
          [SELF_CUSTODIAL_ACCOUNT_ID]: { btcId: "", usdId: "" },
        },
      }

      const { result } = renderHook(() =>
        useTransactionSeenState({
          accountId,
          isSelfCustodial: mockIsSelfCustodial,
          transactions: [btcTx, usdTx],
        }),
      )

      expect(result.current.hasUnseenBtcTx).toBe(true)
      expect(result.current.hasUnseenUsdTx).toBe(true)
    })

    it("skips the last-seen query instead of watching a cache nothing reads", () => {
      renderHook(() =>
        useTransactionSeenState({
          accountId,
          isSelfCustodial: mockIsSelfCustodial,
          transactions: [btcTx, usdTx],
        }),
      )

      expect(mockUseTxLastSeenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })

    it("treats a stored transaction as already seen across a cold start", () => {
      mockPersistentState = {
        ...defaultPersistentState,
        activeAccountId: SELF_CUSTODIAL_ACCOUNT_ID,
        txLastSeenByAccountId: {
          [SELF_CUSTODIAL_ACCOUNT_ID]: { btcId: "sc-btc", usdId: "sc-usd" },
        },
      }

      const { result } = renderHook(() =>
        useTransactionSeenState({
          accountId,
          isSelfCustodial: mockIsSelfCustodial,
          transactions: [btcTx, usdTx],
        }),
      )

      expect(result.current.hasUnseenBtcTx).toBe(false)
      expect(result.current.hasUnseenUsdTx).toBe(false)
    })

    it("treats an empty device store as nothing seen yet", () => {
      const { result } = renderHook(() =>
        useTransactionSeenState({
          accountId,
          isSelfCustodial: mockIsSelfCustodial,
          transactions: [btcTx, usdTx],
        }),
      )

      expect(result.current.lastSeenBtcId).toBe("")
      expect(result.current.hasUnseenBtcTx).toBe(true)
    })

    it("never falls back to cached custodial transactions", () => {
      mockClient.readQuery.mockReturnValue({
        me: {
          defaultAccount: {
            pendingIncomingTransactions: [
              buildTx({ id: "custodial-btc", createdAt: 99 }),
            ],
            transactions: { edges: [] },
          },
        },
      })

      const { result } = renderHook(() =>
        useTransactionSeenState({ accountId, isSelfCustodial: mockIsSelfCustodial }),
      )

      expect(mockClient.readQuery).not.toHaveBeenCalled()
      expect(result.current.latestBtcTxId).toBe("")
      expect(result.current.hasUnseenBtcTx).toBe(false)
    })

    it("marks seen on device instead of the Apollo cache", () => {
      const { result } = renderHook(() =>
        useTransactionSeenState({
          accountId,
          isSelfCustodial: mockIsSelfCustodial,
          transactions: [btcTx],
        }),
      )

      act(() => {
        result.current.markTxSeen(WalletCurrency.Btc)
      })

      expect(mockMarkTxLastSeenId).not.toHaveBeenCalled()
      expect(mockUpdateState).toHaveBeenCalledTimes(1)

      const [updater] = mockUpdateState.mock.calls[0]
      expect(updater(mockPersistentState).txLastSeenByAccountId).toEqual({
        [SELF_CUSTODIAL_ACCOUNT_ID]: { btcId: "sc-btc", usdId: "" },
      })
    })

    it("does not mark anything when there is no transaction for the currency", () => {
      const { result } = renderHook(() =>
        useTransactionSeenState({
          accountId,
          isSelfCustodial: mockIsSelfCustodial,
          transactions: [btcTx],
        }),
      )

      act(() => {
        result.current.markTxSeen(WalletCurrency.Usd)
      })

      expect(mockUpdateState).not.toHaveBeenCalled()
    })
  })
})
