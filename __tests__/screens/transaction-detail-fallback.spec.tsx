import React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import type { ResolveTransactionAccountStatus } from "@app/hooks/use-resolve-transaction-account"
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

jest.mock("@app/components/atomic/galoy-icon-button", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const { Pressable: RNPressable } = jest.requireActual("react-native")
  return {
    GaloyIconButton: ({ name, onPress }: { name: string; onPress: () => void }) =>
      ReactActual.createElement(RNPressable, { testID: name, onPress }),
  }
})

jest.mock("@app/components/atomic/galoy-primary-button", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const { Pressable: RNPressable, Text: RNText } = jest.requireActual("react-native")
  return {
    GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) =>
      ReactActual.createElement(
        RNPressable,
        { testID: "primary-button", onPress },
        ReactActual.createElement(RNText, null, title),
      ),
  }
})

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

const galoyInstance = {
  name: "Blink",
  blockExplorer: "https://mempool.space/tx/",
  sparkExplorer: "https://sparkscan.io/tx/",
}

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance } }),
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
    formatCurrency: () => "$1.00",
  }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: false, wallets: [] }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}))

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
