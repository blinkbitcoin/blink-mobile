import React from "react"

import { fireEvent, render } from "@testing-library/react-native"
import { Linking } from "react-native"

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

// IconAction renders a GaloyIconButton; reduce it to a plain Pressable so the
// explorer / copy icons can be pressed by testID without the themed internals.
jest.mock("@app/components/atomic/galoy-icon-button", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const { Pressable: RNPressable } = jest.requireActual("react-native")
  return {
    GaloyIconButton: ({ name, onPress }: { name: string; onPress: () => void }) =>
      ReactActual.createElement(RNPressable, { testID: name, onPress }),
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
      },
      TransactionDetailScreen: {
        received: LLText,
        sending: LLText,
        spent: LLText,
        paid: LLText,
        receivingAccount: LLText,
        sendingAccount: LLText,
        txNotBroadcast: LLText,
      },
    },
    locale: "en",
  }),
}))

const broadcastedOnChainTx = (transactionHash: string) => ({
  data: {
    __typename: "Transaction",
    id: "tx-1",
    status: "SUCCESS",
    direction: "SEND",
    createdAt: 1721800000,
    settlementCurrency: "BTC",
    settlementAmount: -1000,
    settlementFee: 10,
    settlementDisplayFee: "0.01",
    settlementDisplayAmount: "-1.00",
    settlementDisplayCurrency: "USD",
    settlementVia: {
      __typename: "SettlementViaOnChain",
      transactionHash,
      arrivalInMempoolEstimatedAt: null,
    },
    initiationVia: { __typename: "InitiationViaOnChain", address: "" },
  },
})

const route = {
  key: "transactionDetail",
  name: "transactionDetail",
  params: { txid: "tx-1" },
} as never

const renderScreenWithHash = (transactionHash: string) => {
  mockUseFragment.mockReturnValue(broadcastedOnChainTx(transactionHash))
  return render(<TransactionDetailScreen route={route} />)
}

describe("TransactionDetailScreen viewInExplorer", () => {
  const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)

  beforeEach(() => {
    openURLSpy.mockClear()
  })

  it("opens a spark transaction (UUID hash with dashes) on the spark explorer", () => {
    const sparkTxId = "0196fe12-7fca-7d55-8d9d-1af6f9f0e7b9"
    const { getByTestId } = renderScreenWithHash(sparkTxId)

    fireEvent.press(getByTestId("arrow-square-out"))

    expect(openURLSpy).toHaveBeenCalledWith("https://sparkscan.io/tx/" + sparkTxId)
  })

  it("opens an onchain transaction (hex hash) on the block explorer", () => {
    const onChainTxHash =
      "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"
    const { getByTestId } = renderScreenWithHash(onChainTxHash)

    fireEvent.press(getByTestId("arrow-square-out"))

    expect(openURLSpy).toHaveBeenCalledWith("https://mempool.space/tx/" + onChainTxHash)
  })
})
