import React from "react"

import { render } from "@testing-library/react-native"

import { TransactionDetailScreen } from "@app/screens/transaction-detail-screen/transaction-detail-screen"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
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

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", { testID: "screen" }, children),
}))

jest.mock("@app/components/icon-transactions", () => ({ IconTransaction: () => null }))
jest.mock("@app/components/wallet-summary", () => ({ WalletSummary: () => null }))
jest.mock("@app/components/transaction-date", () => ({ TransactionDate: () => null }))
jest.mock("@app/components/atomic/galoy-info", () => ({ GaloyInfo: () => null }))
jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: () => null,
}))
jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: () => null,
}))
jest.mock("@app/components/transaction-item", () => ({
  useDescriptionDisplay: () => "some description",
}))

const mockUseFragment = jest.fn()
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useFragment: () => mockUseFragment(),
}))

jest.mock("@app/graphql/generated", () => ({
  TransactionFragmentDoc: {},
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  useTransactionListForDefaultAccountLazyQuery: () => [jest.fn()],
  useHomeAuthedQuery: () => ({ data: undefined }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        name: "Blink",
        blockExplorer: "https://mempool.space/tx/",
        sparkExplorer: "https://sparkscan.io/tx/",
      },
    },
  }),
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
  useTransactionSeenState: () => ({
    latestBtcTxId: undefined,
    latestUsdTxId: undefined,
    markTxSeen: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: () => "1,000 sats",
    formatCurrency: () => "$0.01",
  }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: false, wallets: [] }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}))

jest.mock("@app/hooks/use-resolve-transaction-account", () => ({
  useResolveTransactionAccount: () => ({ status: "resolved", retry: jest.fn() }),
}))

// Real english copy, so the assertions below pin the whole heading and not a stub.
jest.mock("@app/i18n/i18n-react", () => {
  const { i18nObject } = jest.requireActual("@app/i18n/i18n-util")
  const { loadLocale } = jest.requireActual("@app/i18n/i18n-util.sync")
  loadLocale("en")
  return { useI18nContext: () => ({ LL: i18nObject("en"), locale: "en" }) }
})

const route = {
  key: "transactionDetail",
  name: "transactionDetail",
  params: { txid: "tx-1" },
} as never

const lightningSend = {
  __typename: "Transaction",
  id: "tx-1",
  status: "SUCCESS",
  direction: "SEND",
  memo: "Pay to catalyst@blink.sv",
  createdAt: 1785589616,
  settlementAmount: -23,
  settlementFee: 2,
  settlementDisplayAmount: "-0.01",
  settlementDisplayFee: "0.00",
  settlementCurrency: "BTC",
  settlementDisplayCurrency: "USD",
  settlementVia: { __typename: "SettlementViaLn", preImage: null },
  initiationVia: { __typename: "InitiationViaLn", paymentHash: "c94e998a" },
}

const headingOf = (tree: ReturnType<typeof render>) =>
  tree.UNSAFE_getAllByType("Text" as never).find((n) => n.props.type === "h2")

// The heading lost its trailing word intermittently on Android: the Text was
// measured as one line, then re-broken after "You" on a later layout pass, and
// the wrapped word fell outside the already-fixed container height. Pinning it
// to a single line makes that unrepresentable.
describe("TransactionDetailScreen heading", () => {
  beforeEach(() => jest.clearAllMocks())

  it("renders the full spend copy, never a truncated prefix", () => {
    mockUseFragment.mockReturnValue({ data: lightningSend })

    const heading = headingOf(render(<TransactionDetailScreen route={route} />))

    expect(heading?.props.children).toBe("You spent")
  })

  it("keeps the heading on a single line so a re-break cannot drop a word", () => {
    mockUseFragment.mockReturnValue({ data: lightningSend })

    const heading = headingOf(render(<TransactionDetailScreen route={route} />))

    expect(heading?.props.numberOfLines).toBe(1)
  })

  it("applies the same guarantee to the receive copy", () => {
    mockUseFragment.mockReturnValue({
      data: { ...lightningSend, direction: "RECEIVE", settlementAmount: 23 },
    })

    const heading = headingOf(render(<TransactionDetailScreen route={route} />))

    expect(heading?.props.children).toBe("You received")
    expect(heading?.props.numberOfLines).toBe(1)
  })
})
