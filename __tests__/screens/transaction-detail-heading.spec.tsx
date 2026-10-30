import React from "react"

import { render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { TransactionDetailScreen } from "@app/screens/transaction-detail-screen/transaction-detail-screen"
import { toTransactionFragment } from "@app/self-custodial/mappers/to-transaction-fragment"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"

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
// The enums are real so the self-custodial cases can go through the real mapper.
jest.mock("@app/graphql/generated", () => {
  const { TxDirection, TxStatus } = jest.requireActual("@app/graphql/generated")
  return {
    ...jest.requireActual("../helpers/transaction-detail-mocks").mockGeneratedGraphql(),
    TxDirection,
    TxStatus,
  }
})
jest.mock("@app/hooks", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockAppHooks(),
)
jest.mock("@app/hooks/use-display-currency", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockDisplayCurrency(),
)
jest.mock("@react-navigation/native", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockNavigation(),
)

/** The screen reads the wallet history to tell whether the transaction being shown is the
 *  newest one. Mocked away here because this spec only renders the heading, and loading
 *  the real mapper would pull the generated enums that the graphql mock above leaves out. */
const mockNoFragments: unknown[] = []
jest.mock("@app/self-custodial/hooks/use-self-custodial-transaction-fragments", () => ({
  useSelfCustodialTransactionFragments: () => mockNoFragments,
}))

const mockNoTransactions: unknown[] = []
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ allTransactions: mockNoTransactions }),
}))

jest.mock("@app/components/icon-transactions", () => ({ IconTransaction: () => null }))
jest.mock("@app/components/wallet-summary", () => ({ WalletSummary: () => null }))
jest.mock("@app/components/transaction-date", () => ({ TransactionDate: () => null }))
jest.mock("@app/components/atomic/galoy-info", () => ({ GaloyInfo: () => null }))
jest.mock("@app/components/transaction-item", () => ({
  useDescriptionDisplay: () => "some description",
}))
let mockIsSelfCustodial = false
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: mockIsSelfCustodial, wallets: [] }),
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

// transactionHash === null is what marks an onchain send as still queued.
const queuedOnChainSend = {
  ...lightningSend,
  settlementVia: {
    __typename: "SettlementViaOnChain",
    transactionHash: null,
    arrivalInMempoolEstimatedAt: null,
  },
  initiationVia: { __typename: "InitiationViaOnChain", address: "bc1qexample" },
}

// Once the transaction hash is known the same onchain send has left the queue.
const broadcastOnChainSend = {
  ...queuedOnChainSend,
  settlementVia: {
    ...queuedOnChainSend.settlementVia,
    transactionHash: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
  },
}

// A transfer to yourself pays no one, which is why the heading says "sent" and not "spent".
// It documents that motivation rather than adding coverage: the heading never reads the
// settlement rail, so this passes for the same reason the lightning send does.
const selfTransfer = {
  ...lightningSend,
  memo: null,
  settlementVia: { __typename: "SettlementViaIntraLedger", counterPartyUsername: null },
  initiationVia: { __typename: "InitiationViaIntraLedger", counterPartyUsername: null },
}

const selfCustodialSend = (
  overrides: Partial<NormalizedTransaction>,
): NormalizedTransaction => ({
  id: "tx-1",
  amount: { amount: 23, currency: WalletCurrency.Btc, currencyCode: WalletCurrency.Btc },
  direction: TransactionDirection.Send,
  status: TransactionStatus.Completed,
  timestamp: 1785589616,
  paymentType: PaymentType.Spark,
  sourceAccountType: AccountType.SelfCustodial,
  ...overrides,
})

const renderHeading = (tx: unknown) => {
  mockUseFragment.mockReturnValue({ data: tx })
  const tree = render(<TransactionDetailScreen route={route} />)
  const heading = tree
    .UNSAFE_getAllByType("Text" as never)
    .find((node) => node.props.type === "h2")

  return { heading, tree }
}

// The heading lost its trailing word intermittently on Android: the Text was
// measured as one line, then re-broken after "You" on a later layout pass, and
// the wrapped word fell outside the already-fixed container height. Pinning it
// to a single line makes that unrepresentable; adjustsFontSizeToFit keeps a
// long locale whole under font scaling rather than trading the drop for an
// ellipsis.
describe("TransactionDetailScreen heading", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSelfCustodial = false
  })

  const cases: Array<{ name: string; tx: unknown; copy: string }> = [
    { name: "send", tx: lightningSend, copy: "You sent" },
    { name: "self-transfer", tx: selfTransfer, copy: "You sent" },
    {
      name: "receive",
      tx: { ...lightningSend, direction: "RECEIVE", settlementAmount: 23 },
      copy: "You received",
    },
    { name: "queued onchain send", tx: queuedOnChainSend, copy: "Sending" },
    { name: "broadcast onchain send", tx: broadcastOnChainSend, copy: "You sent" },
    // Today's behaviour, not a decision: the heading ignores status, so a payment that
    // failed or has not settled still reads "You sent". The follow-up that makes the
    // heading status-aware flips these on purpose.
    {
      name: "failed send",
      tx: { ...lightningSend, status: "FAILURE" },
      copy: "You sent",
    },
    {
      name: "pending send",
      tx: { ...lightningSend, status: "PENDING" },
      copy: "You sent",
    },
  ]

  cases.forEach(({ name, tx, copy }) => {
    it(`renders the full ${name} copy, never a truncated prefix`, () => {
      const { heading, tree } = renderHeading(tx)

      expect(heading?.props.children).toBe(copy)
      tree.unmount()
    })

    it(`keeps the ${name} heading on one line, shrinking rather than clipping`, () => {
      const { heading, tree } = renderHeading(tx)

      expect(heading?.props.numberOfLines).toBe(1)
      expect(heading?.props.adjustsFontSizeToFit).toBe(true)
      tree.unmount()
    })
  })
})

// Self-custodial transactions reach the screen through the same Apollo fragment, written
// there by `toTransactionFragment`, so these cases render what that mapper produces.
describe("TransactionDetailScreen heading for a self-custodial wallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSelfCustodial = true
  })

  const cases: Array<{ name: string; tx: NormalizedTransaction; copy: string }> = [
    { name: "spark send", tx: selfCustodialSend({}), copy: "You sent" },
    {
      name: "receive",
      tx: selfCustodialSend({ direction: TransactionDirection.Receive }),
      copy: "You received",
    },
    // The mapper always sets transactionHash, so a self-custodial onchain send never
    // reads "Sending", even while it is still pending.
    {
      name: "pending onchain send",
      tx: selfCustodialSend({
        paymentType: PaymentType.Onchain,
        status: TransactionStatus.Pending,
      }),
      copy: "You sent",
    },
  ]

  cases.forEach(({ name, tx, copy }) => {
    it(`renders the full ${name} copy`, () => {
      const { heading, tree } = renderHeading(toTransactionFragment(tx))

      expect(heading?.props.children).toBe(copy)
      tree.unmount()
    })
  })
})
