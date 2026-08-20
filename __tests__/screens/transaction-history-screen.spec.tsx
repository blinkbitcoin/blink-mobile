import React from "react"
import { InteractionManager } from "react-native"
import { MockedResponse } from "@apollo/client/testing"
import { RouteProp } from "@react-navigation/native"
import { act, fireEvent, render, waitFor, cleanup } from "@testing-library/react-native"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TransactionHistoryScreen } from "@app/screens/transaction-history"
import {
  TransactionListForDefaultAccountDocument,
  TxLastSeenDocument,
} from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { waitForStableRender } from "../helpers/wait-for-stable-render"

import { ContextForScreen } from "./helper"

let currentMocks: MockedResponse[] = []
const DEFAULT_ACCOUNT_ID = "account-id"
let currentTxLastSeen = { btcId: "", usdId: "" }

jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation((callback) => {
  if (typeof callback === "function") {
    callback()
  }

  return {
    cancel: () => {},
  } as ReturnType<typeof InteractionManager.runAfterInteractions>
})

jest.mock("../../app/graphql/cache", () => {
  const actual = jest.requireActual("../../app/graphql/cache")

  return {
    __esModule: true,
    ...actual,
    createCache: () => {
      const cache = actual.createCache()

      cache.writeQuery({
        query: TxLastSeenDocument,
        variables: { accountId: DEFAULT_ACCOUNT_ID },
        data: {
          __typename: "Query",
          txLastSeen: {
            __typename: "TxLastSeen",
            accountId: DEFAULT_ACCOUNT_ID,
            btcId: currentTxLastSeen.btcId,
            usdId: currentTxLastSeen.usdId,
          },
        },
      })

      return cache
    },
  }
})

jest.mock("@app/graphql/mocks", () => {
  const actual = jest.requireActual("@app/graphql/mocks")
  return {
    __esModule: true,
    get default() {
      // Spec-specific mocks first so they take precedence; the shared mocks
      // backfill every other query fired by mounted components, keeping
      // Apollo's MockLink warning-free.
      return [...currentMocks, ...actual.default]
    },
  }
})

// Records the onPress identity handed to each row, so a test can assert the
// screen shares one stable callback instead of a fresh closure per row —
// a fresh closure defeats React.memo and re-renders the whole list.
const mockOnPressIdentities: Array<(txid: string) => void> = []

jest.mock("@app/components/transaction-item", () => {
  const React = jest.requireActual("react")
  const { Text } = jest.requireActual("react-native")

  type Props = {
    txid: string
    highlight?: boolean
    testId?: string
    onPress?: (txid: string) => void
  }

  const MemoizedTransactionItem = ({ txid, highlight, testId, onPress }: Props) => {
    if (onPress) {
      mockOnPressIdentities.push(onPress)
    }
    return (
      <Text testID={testId}>{`${txid}:${highlight ? "highlight" : "no-highlight"}`}</Text>
    )
  }

  return {
    __esModule: true,
    MemoizedTransactionItem: React.memo(MemoizedTransactionItem),
  }
})

const BTC_WALLET_ID = "e821e124-1c70-4aab-9416-074ee5be21f6"
const USD_WALLET_ID = "5b54bf9a-46cc-4344-b638-b5e5e157a892"

const mockRouteWithCurrencyFilter = (
  currency?: "BTC" | "USD",
): RouteProp<RootStackParamList, "transactionHistory"> => ({
  key: `transactionHistory-test`,
  name: "transactionHistory",
  params: {
    wallets: [
      {
        id: BTC_WALLET_ID,
        walletCurrency: "BTC",
      },
      {
        id: USD_WALLET_ID,
        walletCurrency: "USD",
      },
    ],
    ...(currency ? { currencyFilter: currency } : {}),
  },
})

const buildTransactionMocks = ({
  btcTxId,
  usdTxId,
}: {
  btcTxId: string
  usdTxId: string
}): MockedResponse[] => {
  const wallets = [
    {
      __typename: "BTCWallet",
      id: BTC_WALLET_ID,
      balance: 0,
      walletCurrency: "BTC",
    },
    {
      __typename: "UsdWallet",
      id: USD_WALLET_ID,
      balance: 0,
      walletCurrency: "USD",
    },
  ]

  const btcEdge = {
    __typename: "TransactionEdge",
    cursor: "cursor-1",
    node: {
      __typename: "Transaction",
      id: btcTxId,
      status: "SUCCESS",
      direction: "RECEIVE",
      memo: null,
      createdAt: 1700000000,
      settlementAmount: 1000,
      settlementFee: 0,
      settlementDisplayFee: "0.00",
      settlementCurrency: "BTC",
      settlementDisplayAmount: "0.10",
      settlementDisplayCurrency: "USD",
      settlementPrice: {
        __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
        base: 105000000000,
        offset: 12,
        currencyUnit: "MINOR",
        formattedAmount: "0.105",
      },
      initiationVia: {
        __typename: "InitiationViaLn",
        paymentHash: "hash-1",
        paymentRequest: "payment-request-1",
      },
      settlementVia: {
        __typename: "SettlementViaIntraLedger",
        counterPartyWalletId: null,
        counterPartyUsername: "user_btc",
        preImage: null,
      },
    },
  }

  const usdEdge = {
    __typename: "TransactionEdge",
    cursor: "cursor-2",
    node: {
      __typename: "Transaction",
      id: usdTxId,
      status: "SUCCESS",
      direction: "RECEIVE",
      memo: null,
      createdAt: 1700000001,
      settlementAmount: 1000,
      settlementFee: 0,
      settlementDisplayFee: "0.00",
      settlementCurrency: "USD",
      settlementDisplayAmount: "0.10",
      settlementDisplayCurrency: "USD",
      settlementPrice: {
        __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
        base: 105000000000,
        offset: 12,
        currencyUnit: "MINOR",
        formattedAmount: "0.105",
      },
      initiationVia: {
        __typename: "InitiationViaLn",
        paymentHash: "hash-2",
        paymentRequest: "payment-request-2",
      },
      settlementVia: {
        __typename: "SettlementViaIntraLedger",
        counterPartyWalletId: null,
        counterPartyUsername: "user_usd",
        preImage: null,
      },
    },
  }

  const makeResult = (edges: (typeof btcEdge)[]) => ({
    data: {
      me: {
        __typename: "User",
        id: "user-id",
        defaultAccount: {
          __typename: "ConsumerAccount",
          id: "account-id",
          wallets,
          pendingIncomingTransactions: [],
          transactions: {
            __typename: "TransactionConnection",
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: "cursor-1",
              endCursor: "cursor-1",
            },
            edges,
          },
        },
      },
    },
  })

  const makeRequest = (walletIds: string[], edges: (typeof btcEdge)[]) => ({
    request: {
      query: TransactionListForDefaultAccountDocument,
      variables: {
        first: 21,
        walletIds,
      },
      newData: () => makeResult(edges),
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: makeResult(edges),
  })

  return [
    makeRequest([BTC_WALLET_ID, USD_WALLET_ID], [usdEdge, btcEdge]),
    makeRequest([BTC_WALLET_ID], [btcEdge]),
    makeRequest([USD_WALLET_ID], [usdEdge]),
  ]
}

describe("TransactionHistoryScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    mockOnPressIdentities.length = 0
  })

  afterEach(() => {
    cleanup()
    currentMocks = []
    currentTxLastSeen = { btcId: "", usdId: "" }
  })

  it("hands every row the same onPress callback, across re-renders", async () => {
    currentTxLastSeen = {
      btcId: "507f1f77bcf86cd799439010",
      usdId: "507f1f77bcf86cd799439010",
    }

    currentMocks = buildTransactionMocks({
      btcTxId: "507f1f77bcf86cd799439011",
      usdTxId: "507f1f77bcf86cd799439012",
    })

    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-1")).toBeTruthy()
    })

    // Force a screen re-render: a per-row closure would be rebuilt here.
    const dropdown = screen.getByTestId("wallet-filter-dropdown")
    await act(() => fireEvent.press(dropdown))

    expect(mockOnPressIdentities.length).toBeGreaterThan(1)
    expect(new Set(mockOnPressIdentities).size).toBe(1)
  })

  it("shows all transactions by default", async () => {
    currentTxLastSeen = {
      btcId: "507f1f77bcf86cd799439010",
      usdId: "507f1f77bcf86cd799439010",
    }

    currentMocks = buildTransactionMocks({
      btcTxId: "507f1f77bcf86cd799439011",
      usdTxId: "507f1f77bcf86cd799439012",
    })

    const { findByTestId } = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()} />
      </ContextForScreen>,
    )

    expect(await findByTestId("transaction-by-index-0")).toBeTruthy()
  })

  it("filters only BTC transactions", async () => {
    currentTxLastSeen = {
      btcId: "507f1f77bcf86cd799439010",
      usdId: "507f1f77bcf86cd799439010",
    }

    currentMocks = buildTransactionMocks({
      btcTxId: "507f1f77bcf86cd799439011",
      usdTxId: "507f1f77bcf86cd799439012",
    })

    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy()
    })
    await waitForStableRender(screen)

    const dropdown = screen.getByTestId("wallet-filter-dropdown")
    await act(() => fireEvent.press(dropdown))

    const btcOption = await screen.findByText("Bitcoin")

    await act(() => fireEvent.press(btcOption))

    // Wait for the refetched row, then settle: the dropped row is asserted by
    // absence, and `waitFor` alone would pass on any frame that has not
    // rendered it *yet*.
    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0").props.children).toContain(
        "507f1f77bcf86cd799439011",
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy()
    })
    await waitForStableRender(screen)

    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain(
      "507f1f77bcf86cd799439011",
    )
    expect(screen.queryByTestId("transaction-by-index-1")).toBeNull()
  })

  it("filters only BTC by route param", async () => {
    currentTxLastSeen = {
      btcId: "507f1f77bcf86cd799439010",
      usdId: "507f1f77bcf86cd799439010",
    }

    currentMocks = buildTransactionMocks({
      btcTxId: "507f1f77bcf86cd799439011",
      usdTxId: "507f1f77bcf86cd799439012",
    })

    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter("BTC")} />
      </ContextForScreen>,
    )

    await waitForStableRender(screen)

    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain(
      "507f1f77bcf86cd799439011",
    )
    expect(screen.queryByTestId("transaction-by-index-1")).toBeNull()
  })

  it("switches filter after BTC route param", async () => {
    currentTxLastSeen = {
      btcId: "507f1f77bcf86cd799439010",
      usdId: "507f1f77bcf86cd799439010",
    }

    currentMocks = buildTransactionMocks({
      btcTxId: "507f1f77bcf86cd799439011",
      usdTxId: "507f1f77bcf86cd799439012",
    })

    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter("BTC")} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy()
    })
    await waitForStableRender(screen)

    const dropdown = screen.getByTestId("wallet-filter-dropdown")
    await act(() => fireEvent.press(dropdown))

    const usdOption = await screen.findByText("Dollar")
    await act(() => fireEvent.press(usdOption))

    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0").props.children).toContain(
        "507f1f77bcf86cd799439012",
      )
    })
    await waitForStableRender(screen)

    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain(
      "507f1f77bcf86cd799439012",
    )
    expect(screen.queryByTestId("transaction-by-index-1")).toBeNull()
  })

  it("highlights none when lastSeen ids are missing", async () => {
    currentTxLastSeen = { btcId: "", usdId: "" }

    currentMocks = buildTransactionMocks({
      btcTxId: "507f1f77bcf86cd799439011",
      usdTxId: "507f1f77bcf86cd799439012",
    })

    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy()
    })
    // With no lastSeen ids the screen passes through a transient highlight: the
    // baseline materialises empty, the mapper's "never seen => highlight the
    // newest" rule fires, then markTxSeen writes the ids into the cache and the
    // highlight settles off again. Waiting for the rows to merely *exist* lands
    // on whichever of those frames the machine is on, so settle the tree first.
    await waitForStableRender(screen)

    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain(
      "507f1f77bcf86cd799439012",
    )
    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain(
      "no-highlight",
    )
    expect(screen.getByTestId("transaction-by-index-1").props.children).toContain(
      "507f1f77bcf86cd799439011",
    )
    expect(screen.getByTestId("transaction-by-index-1").props.children).toContain(
      "no-highlight",
    )
  })

  it("highlights transactions newer than min lastSeen when ALL", async () => {
    currentTxLastSeen = {
      btcId: "507f1f77bcf86cd799439015",
      usdId: "507f1f77bcf86cd799439025",
    }

    currentMocks = buildTransactionMocks({
      btcTxId: "507f1f77bcf86cd799439030",
      usdTxId: "507f1f77bcf86cd799439040",
    })

    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy()
    })
    // Settling first is what makes this assertion mean "the highlight survives
    // markTxSeen writing the cache back", rather than "some frame had it".
    await waitForStableRender(screen)

    // min(lastSeenBtcId,lastSeenUsdId) = ...9015 and both are unseen => highlighted
    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain(
      "highlight",
    )
    expect(screen.getByTestId("transaction-by-index-1").props.children).toContain(
      "highlight",
    )
  })
})
