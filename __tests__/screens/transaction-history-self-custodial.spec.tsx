/* eslint-disable @typescript-eslint/no-var-requires, camelcase */
import React from "react"

import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { InteractionManager, SectionList } from "react-native"

import { markTxLastSeenId } from "@app/graphql/client-only-query"
import { TransactionHistoryScreen } from "@app/screens/transaction-history"
import {
  defaultPersistentState,
  type PersistentState,
} from "@app/store/persistent-state/state-migrations"
import { getTxLastSeenIds } from "@app/store/persistent-state/tx-last-seen"
import { ActiveWalletStatus, AccountType } from "@app/types/wallet"

import { flushEffects } from "../helpers/flush-effects"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    textPrimary: "#ccc",
    textSecondary: "#aaa",
    textMuted: "#999",
    surfaceInteractive: "#f5f5f5",
    accent: "#fc5805",
    textOnBackground: "#000",
    backgroundDefault: "#fff",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, unknown>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, unknown> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", { testID: "screen" }, children),
}))

jest.mock("@app/components/transaction-item", () => ({
  MemoizedTransactionItem: ({ txid, highlight }: { txid: string; highlight?: boolean }) =>
    React.createElement(
      "Text",
      { testID: `tx-${txid}` },
      highlight ? "highlight" : "no-highlight",
    ),
  useDescriptionDisplay: () => "",
}))

jest.mock("@app/screens/transaction-history/transaction-history-skeleton", () => ({
  __esModule: true,
  default: () => React.createElement("View", { testID: "transaction-history-skeleton" }),
}))

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
}))

const mockRefetch = jest.fn()
const mockFetchMore = jest.fn()
const mockUseTransactionListQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useTransactionListForDefaultAccountQuery: () => mockUseTransactionListQuery(),
  useWalletOverviewScreenQuery: () => ({ data: undefined }),
  useTxLastSeenQuery: () => ({ data: { txLastSeen: { btcId: "", usdId: "" } } }),
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  TxDirection: { Receive: "RECEIVE", Send: "SEND" },
  TxStatus: { Pending: "PENDING", Failure: "FAILURE", Success: "SUCCESS" },
  TransactionFragmentDoc: {},
  HomeAuthedDocument: {},
}))

jest.mock("@app/graphql/client-only-query", () => ({ markTxLastSeenId: jest.fn() }))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

/** Re-renders its readers on every update, as the real provider does, so a test sees what
 *  the screen does with its own writes and not only the state it started from. */
let mockPersistentState: PersistentState
const mockPersistentStateListeners = new Set<() => void>()
const mockUpdateState = jest.fn((updater: (prev: PersistentState) => PersistentState) => {
  mockPersistentState = updater(mockPersistentState)
  mockPersistentStateListeners.forEach((rerender) => rerender())
})
jest.mock("@app/store/persistent-state", () => {
  const { useEffect, useReducer } = jest.requireActual<typeof import("react")>("react")
  return {
    usePersistentStateContext: () => {
      const [, rerender] = useReducer((count: number) => count + 1, 0)
      useEffect(() => {
        mockPersistentStateListeners.add(rerender)
        return () => {
          mockPersistentStateListeners.delete(rerender)
        }
      }, [])
      return { persistentState: mockPersistentState, updateState: mockUpdateState }
    },
  }
})

const custodialQueryWithData = {
  data: {
    me: {
      defaultAccount: {
        id: "account-id",
        pendingIncomingTransactions: [],
        transactions: {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  },
  previousData: undefined,
  error: undefined,
  fetchMore: mockFetchMore,
  refetch: mockRefetch,
  loading: false,
}

/** No transactions loaded yet, but older pages to search through. */
const custodialQueryWithMorePages = {
  ...custodialQueryWithData,
  data: {
    me: {
      defaultAccount: {
        ...custodialQueryWithData.data.me.defaultAccount,
        transactions: {
          edges: [],
          pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
        },
      },
    },
  },
}

const selfCustodialQueryEmpty = {
  data: undefined,
  previousData: undefined,
  error: undefined,
  fetchMore: mockFetchMore,
  refetch: mockRefetch,
  loading: false,
}

const mockCacheBatch = jest.fn()
const mockUseApolloClient = jest.fn()
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => mockUseApolloClient(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

const mockUseActiveWallet = jest.fn()
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

const mockRefreshSelfCustodialWallets = jest.fn().mockResolvedValue(undefined)
const mockSelfCustodialLoadMore = jest.fn().mockResolvedValue(true)
const mockSelfCustodialState: { allTransactions: unknown[]; hasMore: boolean } = {
  allTransactions: [],
  hasMore: false,
}
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    allTransactions: mockSelfCustodialState.allTransactions,
    hasMoreTransactions: mockSelfCustodialState.hasMore,
    loadingMore: false,
    loadMore: mockSelfCustodialLoadMore,
    refreshWallets: mockRefreshSelfCustodialWallets,
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ fractionDigits: 2 }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: undefined,
    displayCurrency: "USD",
  }),
}))

const mockTransitionState = { hasTransitioned: true }
/** The screen reads the seen state through the barrel; only that hook stays real here. */
jest.mock("@app/hooks", () => ({
  useHasTransitioned: () => mockTransitionState.hasTransitioned,
  useTransactionSeenState: jest.requireActual("@app/hooks/use-transaction-seen-state")
    .useTransactionSeenState,
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ feeReimbursementMemo: "" }),
}))

jest.mock("@app/components/wallet-summary", () => {
  const { Pressable } = jest.requireActual("react-native")
  return {
    SEND_WALLET_SUMMARY_TEST_ID: "choose-wallet-to-send-from",
    WalletSummary: ({ onSwitch }: { onSwitch?: () => void }) => (
      <Pressable testID="choose-wallet-to-send-from" onPress={onSwitch} />
    ),
  }
})

// The wallet card's balances come through the send wallets and the dollar-balance gate, which
// these behaviour tests don't exercise. A fixed All → Bitcoin → Dollar cycle stands in.
jest.mock("@app/screens/transaction-history/use-history-wallet-summary", () => {
  const next = { ALL: "BTC", BTC: "USD", USD: "ALL" } as const
  return {
    useHistoryWalletSummary: (selected: keyof typeof next) => ({
      wallet: selected,
      balancePrimary: "0 SAT",
      nextWallet: next[selected],
    }),
  }
})

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { transactionsError: () => "tx error", search: () => "Search" },
      TransactionScreen: {
        noTransaction: () => "No transactions",
        filters: () => "Filters",
        sent: () => "Sent",
        received: () => "Received",
        searchPlaceholder: () => "Search...",
        expandingSearch: () => "Expanding search",
        nothingCameBack: () => "Nothing came back",
      },
    },
    locale: "en",
  }),
}))

jest.mock("@app/self-custodial/mappers/transaction-description", () => ({
  getTransactionDescription: () => "",
}))
const mockToTransactionFragments: jest.Mock<unknown[], unknown[]> = jest.fn(() => [])
jest.mock("@app/self-custodial/mappers/to-transaction-fragment", () => ({
  toTransactionFragments: (a: unknown, b: unknown, c: unknown) =>
    mockToTransactionFragments(a, b, c),
}))

const route = {
  key: "tx-history",
  name: "transactionHistory" as const,
  params: { wallets: [{ id: "btc-1", walletCurrency: "BTC" as const }] },
}

const SELF_CUSTODIAL_ACCOUNT_ID = "self-custodial-account"

const buildFragment = (id: string, settlementCurrency: string, createdAt: number) => ({
  id,
  status: "SUCCESS",
  direction: "RECEIVE",
  settlementCurrency,
  settlementAmount: 1000,
  createdAt,
})

const setActiveWallet = (isSelfCustodial: boolean) => {
  mockUseActiveWallet.mockReturnValue({
    wallets: [
      {
        id: "btc-1",
        walletCurrency: "BTC",
        balance: { amount: 0, currency: "BTC", currencyCode: "BTC" },
        transactions: [],
      },
    ],
    status: ActiveWalletStatus.Ready,
    accountType: isSelfCustodial ? AccountType.SelfCustodial : AccountType.Custodial,
    isReady: true,
    isSelfCustodial,
    needsBackendAuth: !isSelfCustodial,
  })
  mockUseTransactionListQuery.mockReturnValue(
    isSelfCustodial ? selfCustodialQueryEmpty : custodialQueryWithData,
  )
}

describe("TransactionHistoryScreen — self-custodial behavior", () => {
  let interactionsSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockTransitionState.hasTransitioned = true
    mockSelfCustodialState.allTransactions = []
    mockSelfCustodialState.hasMore = false
    mockToTransactionFragments.mockReturnValue([])
    /** An account that already has its seen record, so these tests read the seen state
     *  itself rather than the start of a new or restored account. */
    mockPersistentState = {
      ...defaultPersistentState,
      activeAccountId: SELF_CUSTODIAL_ACCOUNT_ID,
      txLastSeenByAccountId: { [SELF_CUSTODIAL_ACCOUNT_ID]: { btcId: "", usdId: "" } },
    }
    mockUseApolloClient.mockReturnValue({
      cache: {
        identify: () => "Transaction:fake-id",
        batch: mockCacheBatch,
      },
      readQuery: jest.fn(),
      writeFragment: jest.fn(),
    })
    interactionsSpy = jest
      .spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation(((cb: unknown) => {
        if (typeof cb === "function") cb()
        return { cancel: () => {} }
      }) as never)
  })

  afterEach(() => {
    interactionsSpy.mockRestore()
  })

  it("custodial pull-to-refresh calls Apollo refetch and not self-custodial refresh", async () => {
    setActiveWallet(false)

    const { UNSAFE_getByType } = render(<TransactionHistoryScreen route={route} />)
    const list = UNSAFE_getByType(SectionList)

    await act(async () => {
      await list.props.onRefresh?.()
    })

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
    expect(mockRefreshSelfCustodialWallets).not.toHaveBeenCalled()

    await flushEffects()
  })

  it("self-custodial pull-to-refresh calls refreshWallets and not Apollo refetch", async () => {
    setActiveWallet(true)

    const { UNSAFE_getByType } = render(<TransactionHistoryScreen route={route} />)
    const list = UNSAFE_getByType(SectionList)

    await act(async () => {
      await list.props.onRefresh?.()
    })

    await waitFor(() => {
      expect(mockRefreshSelfCustodialWallets).toHaveBeenCalledTimes(1)
    })
    expect(mockRefetch).not.toHaveBeenCalled()

    await flushEffects()
  })

  it("self-custodial mode batches the cache fragment writes through cache.batch", () => {
    mockToTransactionFragments.mockReturnValue([
      {
        id: "tx-1",
        status: "SUCCESS",
        settlementCurrency: "BTC",
        settlementAmount: 1000,
      },
      {
        id: "tx-2",
        status: "SUCCESS",
        settlementCurrency: "BTC",
        settlementAmount: 2000,
      },
    ])
    mockUseActiveWallet.mockReturnValue({
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 0, currency: "BTC", currencyCode: "BTC" },
          transactions: [{ id: "tx-1" }, { id: "tx-2" }],
        },
      ],
      status: ActiveWalletStatus.Ready,
      accountType: AccountType.SelfCustodial,
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    })
    mockUseTransactionListQuery.mockReturnValue(selfCustodialQueryEmpty)

    render(<TransactionHistoryScreen route={route} />)

    expect(mockCacheBatch).toHaveBeenCalled()
  })

  it("custodial mode never triggers cache.batch (no self-custodial fragment work)", () => {
    setActiveWallet(false)

    render(<TransactionHistoryScreen route={route} />)

    expect(mockCacheBatch).not.toHaveBeenCalled()
  })
  ;["ALL", "BTC", "USD"].forEach((currencyFilter) => {
    it(`feeds the ordered allTransactions to the mapper for the ${currencyFilter} filter without reordering`, () => {
      const ordered = [
        { id: "usd-new", amount: { currency: "USD" }, timestamp: 400 },
        { id: "btc-mid", amount: { currency: "BTC" }, timestamp: 300 },
        { id: "usd-old", amount: { currency: "USD" }, timestamp: 100 },
      ]
      mockSelfCustodialState.allTransactions = ordered
      setActiveWallet(true)

      render(
        <TransactionHistoryScreen
          route={{ ...route, params: { ...route.params, currencyFilter } } as never}
        />,
      )

      expect(mockToTransactionFragments.mock.calls[0][0]).toEqual(ordered)
    })
  })

  it("keeps the skeleton until the enter transition finishes, even with data ready", () => {
    mockTransitionState.hasTransitioned = false
    mockSelfCustodialState.allTransactions = [
      { id: "tx-1", amount: { currency: "BTC" }, timestamp: 1 },
    ]
    mockToTransactionFragments.mockReturnValue([
      {
        id: "tx-1",
        status: "SUCCESS",
        settlementCurrency: "BTC",
        settlementAmount: 1000,
      },
    ])
    setActiveWallet(true)

    const { queryByTestId, UNSAFE_queryByType } = render(
      <TransactionHistoryScreen route={route} />,
    )

    expect(queryByTestId("transaction-history-skeleton")).toBeTruthy()
    expect(UNSAFE_queryByType(SectionList)).toBeNull()
  })

  describe("seen state", () => {
    const btcNew = buildFragment("sc-btc-new", "BTC", 5)
    const usdNew = buildFragment("sc-usd-new", "USD", 3)

    const renderWithSelfCustodialHistory = (currencyFilter?: string) => {
      mockSelfCustodialState.allTransactions = [
        { id: btcNew.id, amount: { currency: "BTC" }, timestamp: btcNew.createdAt },
        { id: usdNew.id, amount: { currency: "USD" }, timestamp: usdNew.createdAt },
      ]
      mockToTransactionFragments.mockReturnValue([
        btcNew,
        usdNew,
        buildFragment("sc-btc-old", "BTC", 1),
      ])
      setActiveWallet(true)

      return render(
        <TransactionHistoryScreen
          route={
            currencyFilter
              ? ({ ...route, params: { ...route.params, currencyFilter } } as never)
              : route
          }
        />,
      )
    }

    it("records the newest transaction of each currency on device", () => {
      renderWithSelfCustodialHistory()

      expect(getTxLastSeenIds(mockPersistentState)).toEqual({
        btcId: "sc-btc-new",
        usdId: "sc-usd-new",
      })
      expect(markTxLastSeenId).not.toHaveBeenCalled()
    })

    it("records only the filtered currency", () => {
      renderWithSelfCustodialHistory("BTC")

      expect(getTxLastSeenIds(mockPersistentState)).toEqual({
        btcId: "sc-btc-new",
        usdId: "",
      })
    })

    it("keys the device store by the active self-custodial account", () => {
      renderWithSelfCustodialHistory()

      expect(mockPersistentState.txLastSeenByAccountId).toEqual({
        [SELF_CUSTODIAL_ACCOUNT_ID]: { btcId: "sc-btc-new", usdId: "sc-usd-new" },
      })
    })

    describe("after a restore", () => {
      /** The record a restore starts: no ids yet, and a cutoff at 10s. */
      const restoredRecord = { btcId: "", usdId: "", announceSinceMs: 10_000 }

      const renderRestoredHistory = (receive: ReturnType<typeof buildFragment>) => {
        mockPersistentState = {
          ...mockPersistentState,
          txLastSeenByAccountId: { [SELF_CUSTODIAL_ACCOUNT_ID]: restoredRecord },
        }
        mockSelfCustodialState.allTransactions = [
          { id: receive.id, amount: { currency: "BTC" }, timestamp: receive.createdAt },
        ]
        mockToTransactionFragments.mockReturnValue([receive])
        setActiveWallet(true)

        return render(<TransactionHistoryScreen route={route} />)
      }

      it("does not highlight or mark seen a receive from before the record started", async () => {
        const { getByTestId } = renderRestoredHistory(
          buildFragment("sc-btc-replayed", "BTC", 9),
        )
        await flushEffects()

        expect(getByTestId("tx-sc-btc-replayed").props.children).toBe("no-highlight")
        expect(getTxLastSeenIds(mockPersistentState)).toEqual(restoredRecord)
      })

      it("highlights and marks seen a receive from after the record started", async () => {
        const { getByTestId } = renderRestoredHistory(
          buildFragment("sc-btc-after", "BTC", 11),
        )
        await flushEffects()

        expect(getByTestId("tx-sc-btc-after").props.children).toBe("highlight")
        expect(getTxLastSeenIds(mockPersistentState).btcId).toBe("sc-btc-after")
      })
    })

    it("keeps the custodial account on the Apollo cache", () => {
      setActiveWallet(false)
      mockUseTransactionListQuery.mockReturnValue({
        ...custodialQueryWithData,
        data: {
          me: {
            defaultAccount: {
              id: "account-id",
              pendingIncomingTransactions: [],
              transactions: {
                edges: [{ node: buildFragment("custodial-btc", "BTC", 4) }],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      })

      render(<TransactionHistoryScreen route={route} />)

      expect(markTxLastSeenId).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "account-id",
          currency: "BTC",
          id: "custodial-btc",
        }),
      )
      expect(mockUpdateState).not.toHaveBeenCalled()
    })
  })

  it("renders the list once the enter transition finishes", () => {
    mockTransitionState.hasTransitioned = true
    mockSelfCustodialState.allTransactions = [
      { id: "tx-1", amount: { currency: "BTC" }, timestamp: 1 },
    ]
    mockToTransactionFragments.mockReturnValue([
      {
        id: "tx-1",
        status: "SUCCESS",
        settlementCurrency: "BTC",
        settlementAmount: 1000,
      },
    ])
    setActiveWallet(true)

    const { queryByTestId, UNSAFE_getByType } = render(
      <TransactionHistoryScreen route={route} />,
    )

    expect(queryByTestId("transaction-history-skeleton")).toBeNull()
    expect(UNSAFE_getByType(SectionList)).toBeTruthy()
  })

  describe("expanding search", () => {
    // Switching Received off on a list with no sent payments filters it down to nothing.
    const filterToNothing = async (screen: ReturnType<typeof render>) => {
      const options = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0]
      await act(async () => {
        options.headerRight().props.onPress()
      })
      await act(async () => {
        fireEvent.press(screen.getByTestId("filter-received"))
      })
    }

    const deferred = <T,>() => {
      let resolve: (value: T) => void = () => {}
      const promise = new Promise<T>((r) => {
        resolve = r
      })
      return { promise, resolve }
    }

    it("custodial: a failed page settles on Nothing came back and isn't asked for again", async () => {
      setActiveWallet(false)
      mockUseTransactionListQuery.mockReturnValue(custodialQueryWithMorePages)
      mockFetchMore.mockRejectedValue(new Error("network"))

      const screen = render(<TransactionHistoryScreen route={route} />)
      await filterToNothing(screen)

      expect(await screen.findByText("Nothing came back")).toBeTruthy()
      await flushEffects()
      expect(mockFetchMore).toHaveBeenCalledTimes(1)
      expect(screen.queryByText("Expanding search")).toBeNull()
      expect(mockReportError).toHaveBeenCalledWith(
        "transaction-history-search",
        expect.any(Error),
      )
    })

    it("custodial: a page with no new transactions stops the search", async () => {
      setActiveWallet(false)
      mockUseTransactionListQuery.mockReturnValue(custodialQueryWithMorePages)
      mockFetchMore.mockResolvedValue({
        data: { me: { defaultAccount: { transactions: { edges: [] } } } },
      })

      const screen = render(<TransactionHistoryScreen route={route} />)
      await filterToNothing(screen)

      expect(await screen.findByText("Nothing came back")).toBeTruthy()
      await flushEffects()
      expect(mockFetchMore).toHaveBeenCalledTimes(1)
    })

    it("custodial: pulling to refresh retries a stalled search", async () => {
      setActiveWallet(false)
      mockUseTransactionListQuery.mockReturnValue(custodialQueryWithMorePages)
      mockFetchMore.mockRejectedValue(new Error("network"))

      const screen = render(<TransactionHistoryScreen route={route} />)
      await filterToNothing(screen)
      await screen.findByText("Nothing came back")

      await act(async () => {
        await screen.UNSAFE_getByType(SectionList).props.onRefresh?.()
      })

      await waitFor(() => expect(mockFetchMore).toHaveBeenCalledTimes(2))
    })

    it("self-custodial: a page that fails to load settles on Nothing came back", async () => {
      mockSelfCustodialState.hasMore = true
      mockSelfCustodialLoadMore.mockResolvedValue(false)
      setActiveWallet(true)

      const screen = render(<TransactionHistoryScreen route={route} />)
      await filterToNothing(screen)

      expect(await screen.findByText("Nothing came back")).toBeTruthy()
      await flushEffects()
      expect(mockSelfCustodialLoadMore).toHaveBeenCalledTimes(1)
    })

    it("turns the list's own paging off while the search loads pages", async () => {
      mockSelfCustodialState.hasMore = true
      const page = deferred<boolean>()
      mockSelfCustodialLoadMore.mockReturnValue(page.promise)
      setActiveWallet(true)

      const screen = render(<TransactionHistoryScreen route={route} />)
      expect(screen.UNSAFE_getByType(SectionList).props.onEndReached).toEqual(
        expect.any(Function),
      )

      await filterToNothing(screen)

      expect(screen.getByText("Expanding search")).toBeTruthy()
      expect(screen.UNSAFE_getByType(SectionList).props.onEndReached).toBeUndefined()
      expect(mockSelfCustodialLoadMore).toHaveBeenCalledTimes(1)

      await act(async () => {
        page.resolve(false)
      })
    })
  })
})
