/* eslint-disable @typescript-eslint/no-var-requires, camelcase */
import React from "react"

import { render, waitFor } from "@testing-library/react-native"
import { InteractionManager, SectionList } from "react-native"

import { TransactionHistoryScreen } from "@app/screens/transaction-history"
import { ActiveWalletStatus, AccountType } from "@app/types/wallet"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey0: "#ccc",
    grey1: "#aaa",
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#fc5805",
    black: "#000",
    white: "#fff",
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

jest.mock("@app/components/wallet-filter-dropdown", () => ({
  WalletFilterDropdown: () =>
    React.createElement("View", { testID: "wallet-filter-dropdown" }),
}))

jest.mock("@app/components/transaction-item", () => ({
  MemoizedTransactionItem: () => null,
  useDescriptionDisplay: () => "",
}))

jest.mock("@app/screens/transaction-history/transaction-history-skeleton", () => ({
  __esModule: true,
  default: () => React.createElement("View", { testID: "transaction-history-skeleton" }),
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockRefetch = jest.fn()
const mockFetchMore = jest.fn()
const mockUseTransactionListQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useTransactionListForDefaultAccountQuery: () => mockUseTransactionListQuery(),
  useWalletOverviewScreenQuery: () => ({ data: undefined }),
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  TxDirection: { Receive: "RECEIVE", Send: "SEND" },
  TxStatus: { Pending: "PENDING", Failure: "FAILURE", Success: "SUCCESS" },
  TransactionFragmentDoc: {},
}))

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

const scQueryEmpty = {
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
const mockSelfCustodialLoadMore = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
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

jest.mock("@app/hooks", () => ({
  useTransactionSeenState: () => ({
    hasUnseenBtcTx: false,
    hasUnseenUsdTx: false,
    lastSeenBtcId: "",
    lastSeenUsdId: "",
    latestBtcTxId: undefined,
    latestUsdTxId: undefined,
    markTxSeen: jest.fn(),
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ feeReimbursementMemo: "" }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { transactionsError: () => "tx error" },
      TransactionScreen: { noTransaction: () => "No transactions" },
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
    isSelfCustodial ? scQueryEmpty : custodialQueryWithData,
  )
}

describe("TransactionHistoryScreen — self-custodial behavior", () => {
  let interactionsSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockToTransactionFragments.mockReturnValue([])
    mockUseApolloClient.mockReturnValue({
      cache: {
        identify: () => "Transaction:fake-id",
        batch: mockCacheBatch,
      },
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

  it("custodial pull-to-refresh calls Apollo refetch and not SC refresh", async () => {
    setActiveWallet(false)

    const { UNSAFE_getByType } = render(<TransactionHistoryScreen route={route} />)
    const list = UNSAFE_getByType(SectionList)

    await list.props.onRefresh?.()

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
    expect(mockRefreshSelfCustodialWallets).not.toHaveBeenCalled()
  })

  it("self-custodial pull-to-refresh calls refreshWallets and not Apollo refetch", async () => {
    setActiveWallet(true)

    const { UNSAFE_getByType } = render(<TransactionHistoryScreen route={route} />)
    const list = UNSAFE_getByType(SectionList)

    await list.props.onRefresh?.()

    await waitFor(() => {
      expect(mockRefreshSelfCustodialWallets).toHaveBeenCalledTimes(1)
    })
    expect(mockRefetch).not.toHaveBeenCalled()
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
    mockUseTransactionListQuery.mockReturnValue(scQueryEmpty)

    render(<TransactionHistoryScreen route={route} />)

    expect(mockCacheBatch).toHaveBeenCalled()
  })

  it("custodial mode never triggers cache.batch (no SC fragment work)", () => {
    setActiveWallet(false)

    render(<TransactionHistoryScreen route={route} />)

    expect(mockCacheBatch).not.toHaveBeenCalled()
  })
})
