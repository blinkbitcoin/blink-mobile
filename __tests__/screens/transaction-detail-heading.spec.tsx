import React from "react"

import { render } from "@testing-library/react-native"

import { TransactionDetailScreen } from "@app/screens/transaction-detail-screen/transaction-detail-screen"

jest.mock("@rn-vui/themed", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockThemedText(),
)
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockSafeAreaInsets(),
)
jest.mock("@app/components/screen", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockScreen(),
)
jest.mock("@app/components/atomic/galoy-icon-button", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGaloyIconButton(),
)
jest.mock("@app/components/atomic/galoy-primary-button", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGaloyPrimaryButton(),
)
jest.mock("@app/graphql/generated", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGeneratedGraphql(),
)
jest.mock("@app/hooks", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockAppHooks(),
)
jest.mock("@app/hooks/use-display-currency", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockDisplayCurrency(),
)
jest.mock("@react-navigation/native", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockNavigation(),
)

jest.mock("@app/components/icon-transactions", () => ({ IconTransaction: () => null }))
jest.mock("@app/components/wallet-summary", () => ({ WalletSummary: () => null }))
jest.mock("@app/components/transaction-date", () => ({ TransactionDate: () => null }))
jest.mock("@app/components/atomic/galoy-info", () => ({ GaloyInfo: () => null }))
jest.mock("@app/components/transaction-item", () => ({
  useDescriptionDisplay: () => "some description",
}))
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: false, wallets: [] }),
}))
jest.mock("@app/hooks/use-resolve-transaction-account", () => ({
  useResolveTransactionAccount: () => ({ status: "resolved", retry: jest.fn() }),
}))

const mockUseFragment = jest.fn()
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useFragment: () => mockUseFragment(),
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
