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
}

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance } }),
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
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

const ONCHAIN_TX_HASH = "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"
const LN_PAYMENT_HASH = "0001020304050607080900010203040506070809000102030405060708090102"
const LN_PRE_IMAGE = "6bb1e9a3bf6bcbe27a0c1f3a4b7a6a3b4b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e"
const LN_PAYMENT_REQUEST = "lnbc10u1p0example000payment000request000string"
const TX_ID = "tx-1"

const baseTx = {
  __typename: "Transaction",
  id: TX_ID,
  status: "SUCCESS",
  direction: "SEND",
  createdAt: 1721800000,
  settlementCurrency: "BTC",
  settlementAmount: -1000,
  settlementFee: 10,
  settlementDisplayFee: "0.01",
  settlementDisplayAmount: "-1.00",
  settlementDisplayCurrency: "USD",
}

const onChainTx = {
  data: {
    ...baseTx,
    settlementVia: {
      __typename: "SettlementViaOnChain",
      transactionHash: ONCHAIN_TX_HASH,
      arrivalInMempoolEstimatedAt: null,
    },
    initiationVia: { __typename: "InitiationViaOnChain", address: "" },
  },
}

const lightningTx = {
  data: {
    ...baseTx,
    settlementVia: { __typename: "SettlementViaLn", preImage: LN_PRE_IMAGE },
    initiationVia: {
      __typename: "InitiationViaLn",
      paymentHash: LN_PAYMENT_HASH,
      paymentRequest: LN_PAYMENT_REQUEST,
    },
  },
}

const route = {
  key: "transactionDetail",
  name: "transactionDetail",
  params: { txid: TX_ID },
} as never

const renderScreenWithTx = (tx: unknown) => {
  mockUseFragment.mockReturnValue(tx)
  return render(<TransactionDetailScreen route={route} />)
}

const copiedContents = () =>
  mockCopyToClipboard.mock.calls.map(([{ content }]) => content)

// Regression guards for the #3732 / #3898 icon-row rework: every copy /
// open-in-explorer icon on the detail rows must fire its handler with the
// right payload when tapped.
describe("TransactionDetailScreen row icon actions", () => {
  const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)

  beforeEach(() => {
    openURLSpy.mockClear()
    mockCopyToClipboard.mockClear()
  })

  describe("broadcasted onchain transaction", () => {
    it("opens the transaction hash on the block explorer", () => {
      const { getByTestId } = renderScreenWithTx(onChainTx)

      fireEvent.press(getByTestId("arrow-square-out"))

      expect(openURLSpy).toHaveBeenCalledWith(
        "https://mempool.space/tx/" + ONCHAIN_TX_HASH,
      )
    })

    it("copies the transaction hash, description and internal id", () => {
      const { getAllByTestId } = renderScreenWithTx(onChainTx)

      // rows in render order: transaction hash, description, Blink internal id
      const copyIcons = getAllByTestId("copy-paste")
      expect(copyIcons).toHaveLength(3)
      copyIcons.forEach((icon) => fireEvent.press(icon))

      expect(copiedContents()).toEqual([ONCHAIN_TX_HASH, "some description", TX_ID])
    })
  })

  describe("lightning transaction", () => {
    it("opens the payment request in the lightning decoder", () => {
      const { getByTestId } = renderScreenWithTx(lightningTx)

      fireEvent.press(getByTestId("arrow-square-out"))

      expect(openURLSpy).toHaveBeenCalledWith(
        "https://dev.blink.sv/decode?invoice=" + LN_PAYMENT_REQUEST,
      )
    })

    it("copies description, payment hash, preimage, payment request and internal id", () => {
      const { getAllByTestId } = renderScreenWithTx(lightningTx)

      // rows in render order: description, hash, preimage, payment request,
      // Blink internal id
      const copyIcons = getAllByTestId("copy-paste")
      expect(copyIcons).toHaveLength(5)
      copyIcons.forEach((icon) => fireEvent.press(icon))

      expect(copiedContents()).toEqual([
        "some description",
        LN_PAYMENT_HASH,
        LN_PRE_IMAGE,
        LN_PAYMENT_REQUEST,
        TX_ID,
      ])
    })
  })
})
