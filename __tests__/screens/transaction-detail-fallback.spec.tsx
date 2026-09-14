import React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import type { ResolveTransactionAccountStatus } from "@app/hooks/use-resolve-transaction-account"
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

jest.mock("@app/components/icon-transactions", () => ({
  IconTransaction: () => null,
}))

jest.mock("@app/components/wallet-summary", () => ({
  WalletSummary: () => null,
}))

jest.mock("@app/components/transaction-date", () => ({
  TransactionDate: () => null,
}))

jest.mock("@app/components/atomic/galoy-info", () => ({
  GaloyInfo: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon-button", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGaloyIconButton(),
)
jest.mock("@app/components/atomic/galoy-primary-button", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGaloyPrimaryButton(),
)

jest.mock("@app/components/transaction-item", () => ({
  useDescriptionDisplay: () => "some description",
}))

const mockUseFragment = jest.fn()
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useFragment: () => mockUseFragment(),
}))

jest.mock("@app/graphql/generated", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGeneratedGraphql(),
)
jest.mock("@app/hooks", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockAppHooks(),
)
jest.mock("@app/hooks/use-display-currency", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockDisplayCurrency(),
)

const mockNoFragments: unknown[] = []
jest.mock("@app/self-custodial/hooks/use-self-custodial-transaction-fragments", () => ({
  useSelfCustodialTransactionFragments: () => mockNoFragments,
}))

const mockSelfCustodialWallet: { allTransactions: unknown[] } = { allTransactions: [] }
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet,
}))

let mockActiveWallet: { isSelfCustodial: boolean; wallets: unknown[] } = {
  isSelfCustodial: false,
  wallets: [],
}
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet,
}))

jest.mock("@react-navigation/native", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockNavigation(),
)

const LLText = () => ""
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        date: LLText,
        fees: LLText,
        description: LLText,
        type: LLText,
        preimageProofOfPayment: LLText,
        paymentRequest: LLText,
        hasBeenCopiedToClipboard: LLText,
        tryAgain: () => "try-again",
      },
      TransactionDetailScreen: {
        received: LLText,
        sending: LLText,
        spent: LLText,
        paid: LLText,
        receivingAccount: LLText,
        sendingAccount: LLText,
        txNotBroadcast: LLText,
        findingAccount: () => "finding-account",
        txNotFoundInAccounts: () => "tx-not-found",
        txLoadFailed: () => "tx-load-failed",
      },
    },
    locale: "en",
  }),
}))

const mockRetry = jest.fn()
let mockResolveStatus: ResolveTransactionAccountStatus = "resolving"
const mockUseResolveTransactionAccount = jest.fn((_args: unknown) => ({
  status: mockResolveStatus,
  retry: mockRetry,
}))
jest.mock("@app/hooks/use-resolve-transaction-account", () => ({
  useResolveTransactionAccount: (args: unknown) => mockUseResolveTransactionAccount(args),
}))

const route = {
  key: "transactionDetail",
  name: "transactionDetail",
  params: { txid: "tx-1", recipientUserId: "user-b" },
} as never

const renderWithStatus = (status: ResolveTransactionAccountStatus) => {
  mockResolveStatus = status
  mockUseFragment.mockReturnValue({ data: {} })
  return render(<TransactionDetailScreen route={route} />)
}

// Fallback UI while the multi-account resolver (#3826) figures out which saved
// profile owns a transaction that is missing from the active account's cache.
describe("TransactionDetailScreen resolver fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveWallet = { isSelfCustodial: false, wallets: [] }
    mockSelfCustodialWallet.allTransactions = []
  })

  it("passes txid, cache state and the payload hint to the resolver", () => {
    renderWithStatus("resolving")

    expect(mockUseResolveTransactionAccount).toHaveBeenCalledWith({
      txid: "tx-1",
      hasTx: false,
      recipientUserId: "user-b",
    })
  })

  it("shows the finding-account state while resolving", () => {
    const { getByText, queryByText } = renderWithStatus("resolving")

    expect(getByText("finding-account")).toBeTruthy()
    expect(queryByText("tx-not-found")).toBeNull()
  })

  it("shows the finding-account state while switching accounts", () => {
    const { getByText } = renderWithStatus("switching")

    expect(getByText("finding-account")).toBeTruthy()
  })

  it("shows the not-found message when no account owns the tx", () => {
    const { getByText, queryByText } = renderWithStatus("notFound")

    expect(getByText("tx-not-found")).toBeTruthy()
    expect(queryByText("try-again")).toBeNull()
  })

  it("shows the failure message with a working retry when probing failed", () => {
    const { getByText, getByTestId } = renderWithStatus("probeFailed")

    expect(getByText("tx-load-failed")).toBeTruthy()

    fireEvent.press(getByTestId("primary-button"))
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })

  it("falls back to the failure message when resolved but the fragment stayed empty", () => {
    const { getByText } = renderWithStatus("resolved")

    expect(getByText("tx-load-failed")).toBeTruthy()
  })

  it("reports hasTx when the active self-custodial wallet holds the tx in memory", () => {
    // hasTx keeps the resolver settled on "resolved"; with the fragment still
    // empty the screen must show the actionable failure state, not a spinner.
    mockResolveStatus = "resolved"
    mockActiveWallet = { isSelfCustodial: true, wallets: [] }
    mockSelfCustodialWallet.allTransactions = [{ id: "tx-1", paymentType: "spark" }]
    mockUseFragment.mockReturnValue({ data: {} })
    const { getByText, queryByText } = render(<TransactionDetailScreen route={route} />)

    expect(mockUseResolveTransactionAccount).toHaveBeenCalledWith(
      expect.objectContaining({ hasTx: true }),
    )
    expect(getByText("tx-load-failed")).toBeTruthy()
    expect(queryByText("finding-account")).toBeNull()
  })

  it("reports hasTx to the resolver when the fragment is populated", () => {
    mockResolveStatus = "idle"
    mockUseFragment.mockReturnValue({
      data: { __typename: "Transaction", id: "tx-1" },
    })
    render(<TransactionDetailScreen route={route} />)

    expect(mockUseResolveTransactionAccount).toHaveBeenCalledWith(
      expect.objectContaining({ hasTx: true }),
    )
  })
})
