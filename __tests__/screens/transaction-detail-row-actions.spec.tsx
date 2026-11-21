import React from "react"

import { fireEvent, render } from "@testing-library/react-native"
import { Linking } from "react-native"

import { TransactionDetailScreen } from "@app/screens/transaction-detail-screen/transaction-detail-screen"

import { surfaceColor } from "../helpers/surface-color"

jest.mock("@rn-vui/themed", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockThemedText(),
)
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockSafeAreaInsets(),
)
jest.mock("@app/components/screen", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockScreen(),
)
// The close button is a GaloyIconButton; the shared mock reduces it to a plain Pressable.
jest.mock("@app/components/atomic/galoy-icon-button", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGaloyIconButton(),
)
jest.mock("@app/components/atomic/galoy-primary-button", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGaloyPrimaryButton(),
)
jest.mock("@app/graphql/generated", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockGeneratedGraphql(),
)
jest.mock("@app/hooks/use-display-currency", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockDisplayCurrency(),
)
jest.mock("@react-navigation/native", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockNavigation(),
)

jest.mock("@app/components/icon-transactions", () => ({
  IconTransaction: () => null,
}))

jest.mock("@app/components/wallet-summary", () => ({
  WalletSummary: () => null,
}))

jest.mock("@app/components/transaction-date", () => ({
  TransactionDate: () => null,
  formatDateForTransaction: () => "24 Jul 2024, 06:26",
}))

jest.mock("@app/components/atomic/galoy-info", () => ({
  GaloyInfo: () => null,
}))

let mockDescription = "some description"
jest.mock("@app/components/transaction-item", () => ({
  useDescriptionDisplay: () => mockDescription,
}))

// These specs always render with a populated fragment; the multi-account
// resolver (#3826) is exercised in transaction-detail-fallback.spec.tsx.
jest.mock("@app/hooks/use-resolve-transaction-account", () => ({
  useResolveTransactionAccount: () => ({ status: "resolved", retry: jest.fn() }),
}))

const mockUseFragment = jest.fn()
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useFragment: () => mockUseFragment(),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () =>
  jest
    .requireActual("../helpers/transaction-detail-mocks")
    .mockAppHooks({ getCopyToClipboard: () => mockCopyToClipboard }),
)

let mockIsSelfCustodial = false
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: mockIsSelfCustodial, wallets: [] }),
}))

const mockNoTransactions: unknown[] = []
jest.mock("@app/self-custodial/hooks/use-self-custodial-transaction-fragments", () => ({
  useSelfCustodialTransactionFragments: () => mockNoTransactions,
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ allTransactions: mockNoTransactions }),
}))

// Rows are found by their label, so the labels the spec presses get a copy.
jest.mock("@app/i18n/i18n-react", () =>
  jest.requireActual("../helpers/transaction-detail-mocks").mockI18n({
    "common.advanced": "advanced",
    "common.note": "note",
    "common.preimageProofOfPayment": "preimage",
    "common.paymentRequest": "payment-request",
    "TransactionDetailScreen.transactionId": "transaction-id",
    "TransactionDetailScreen.hash": "hash",
    "TransactionDetailScreen.blinkInternalId": "internal-id",
    "TransactionDetailScreen.sparkTransferId": "spark-transfer-id",
    "TransactionDetailScreen.openInExplorer": "open-in-explorer",
    "TransactionDetailScreen.openInDecoder": "open-in-decoder",
    "TransactionDetailScreen.bitcoinAddress": "bitcoin-address",
    "TransactionDetailScreen.recipient": "recipient",
  }),
)

const ONCHAIN_TX_HASH = "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"
const SPARK_TX_ID = "0196fe12-7fca-7d55-8d9d-1af6f9f0e7b9"
const LN_PAYMENT_HASH = "0001020304050607080900010203040506070809000102030405060708090102"
const LN_PRE_IMAGE = "6bb1e9a3bf6bcbe27a0c1f3a4b7a6a3b4b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e"
const LN_PAYMENT_REQUEST = "lnbc10u1p0example000payment000request000string"
const TX_ID = "tx-1"
const ONCHAIN_ADDRESS = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"

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

const broadcastedOnChainTx = (transactionHash: string, address = "") => ({
  data: {
    ...baseTx,
    settlementVia: {
      __typename: "SettlementViaOnChain",
      transactionHash,
      arrivalInMempoolEstimatedAt: null,
    },
    initiationVia: { __typename: "InitiationViaOnChain", address },
  },
})

const intraLedgerTx = {
  data: {
    ...baseTx,
    settlementVia: {
      __typename: "SettlementViaIntraLedger",
      counterPartyUsername: "alice",
      counterPartyWalletId: "wallet-alice",
      preImage: null,
    },
    initiationVia: {
      __typename: "InitiationViaIntraLedger",
      counterPartyUsername: "alice",
      counterPartyWalletId: "wallet-alice",
    },
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

// Every Advanced row copies when tapped anywhere on it; its copy icon is only the cue.
// Note and Sender/Recipient copy the same way, without an icon.
// One button under the Advanced card opens the payment: the Bitcoin transaction on
// the block explorer, else the Spark transfer on sparkscan, else the invoice in the
// Lightning decoder.
describe("TransactionDetailScreen row actions", () => {
  const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)

  beforeEach(() => {
    openURLSpy.mockClear()
    mockCopyToClipboard.mockClear()
    mockIsSelfCustodial = false
    mockDescription = "some description"
  })

  const renderExpanded = (tx: unknown) => {
    const screen = renderScreenWithTx(tx)
    fireEvent.press(screen.getByTestId("advanced"))
    return screen
  }

  describe("broadcasted onchain transaction", () => {
    it("opens the transaction hash on the block explorer", () => {
      const { getByLabelText } = renderExpanded(broadcastedOnChainTx(ONCHAIN_TX_HASH))

      fireEvent.press(getByLabelText("open-in-explorer"))

      expect(openURLSpy).toHaveBeenCalledWith(
        "https://mempool.space/tx/" + ONCHAIN_TX_HASH,
      )
    })

    it("copies the transaction hash and internal id when their rows are tapped", () => {
      const { getByTestId } = renderExpanded(broadcastedOnChainTx(ONCHAIN_TX_HASH))

      fireEvent.press(getByTestId("transaction-id"))
      fireEvent.press(getByTestId("internal-id"))

      expect(copiedContents()).toEqual([ONCHAIN_TX_HASH, TX_ID])
      expect(openURLSpy).not.toHaveBeenCalled()
    })

    it("keeps each technical value on one line, cut in the middle", () => {
      const { getByText } = renderExpanded(broadcastedOnChainTx(ONCHAIN_TX_HASH))

      const value = getByText(ONCHAIN_TX_HASH)
      expect(value.props.numberOfLines).toBe(1)
      expect(value.props.ellipsizeMode).toBe("middle")
    })

    it("shows the Bitcoin address first and copies it from its row", () => {
      const { getByTestId } = renderExpanded(
        broadcastedOnChainTx(ONCHAIN_TX_HASH, ONCHAIN_ADDRESS),
      )

      fireEvent.press(getByTestId("bitcoin-address"))

      expect(copiedContents()).toEqual([ONCHAIN_ADDRESS])
    })

    it("leaves the Bitcoin address out when the payment has none", () => {
      const { queryByTestId } = renderExpanded(broadcastedOnChainTx(ONCHAIN_TX_HASH))

      expect(queryByTestId("bitcoin-address")).toBeNull()
    })

    it("still copies the note when its row is tapped", () => {
      const { getByTestId } = renderScreenWithTx(broadcastedOnChainTx(ONCHAIN_TX_HASH))

      fireEvent.press(getByTestId("note"))

      expect(copiedContents()).toEqual(["some description"])
    })

    it("shows a dash for a payment without a note, and copies nothing", () => {
      mockDescription = ""
      const { getByTestId, getByText } = renderScreenWithTx(
        broadcastedOnChainTx(ONCHAIN_TX_HASH),
      )

      expect(getByText("-")).toBeTruthy()
      fireEvent.press(getByTestId("note"))

      expect(copiedContents()).toEqual([])
    })
  })

  describe("self-custodial onchain transaction", () => {
    it("shows the Spark transfer ID and opens it on sparkscan", () => {
      mockIsSelfCustodial = true
      const { getByLabelText, getByTestId, queryByTestId } = renderExpanded(
        broadcastedOnChainTx(SPARK_TX_ID),
      )

      expect(queryByTestId("transaction-id")).toBeNull()
      expect(queryByTestId("internal-id")).toBeNull()
      fireEvent.press(getByTestId("spark-transfer-id"))
      fireEvent.press(getByLabelText("open-in-explorer"))

      expect(copiedContents()).toEqual([SPARK_TX_ID])
      expect(openURLSpy).toHaveBeenCalledWith("https://sparkscan.io/tx/" + SPARK_TX_ID)
    })
  })

  describe("lightning transaction", () => {
    it("opens the payment request in the lightning decoder", () => {
      const { getByLabelText, queryByLabelText } = renderExpanded(lightningTx)

      expect(queryByLabelText("open-in-explorer")).toBeNull()
      fireEvent.press(getByLabelText("open-in-decoder"))

      expect(openURLSpy).toHaveBeenCalledWith(
        "https://dev.blink.sv/decode?invoice=" + LN_PAYMENT_REQUEST,
      )
    })

    it("copies payment hash, preimage, payment request and internal id", () => {
      const { getByTestId } = renderExpanded(lightningTx)

      fireEvent.press(getByTestId("hash"))
      fireEvent.press(getByTestId("preimage"))
      fireEvent.press(getByTestId("payment-request"))
      fireEvent.press(getByTestId("internal-id"))

      expect(copiedContents()).toEqual([
        LN_PAYMENT_HASH,
        LN_PRE_IMAGE,
        LN_PAYMENT_REQUEST,
        TX_ID,
      ])
      expect(openURLSpy).not.toHaveBeenCalled()
    })

    it("keeps the technical rows folded away until Advanced is opened", () => {
      const { queryByTestId } = renderScreenWithTx(lightningTx)

      expect(queryByTestId("hash")).toBeNull()
      expect(queryByTestId("payment-request")).toBeNull()
    })
  })

  // A row with a copy or explorer icon is a press target, so it keeps the tappable
  // surfaceInteractive; a row with nothing to press takes the surfaceStatic (blink-wip#1871).
  describe("intraledger transaction", () => {
    it("copies the recipient's username when its row is tapped", () => {
      const { getByTestId } = renderScreenWithTx(intraLedgerTx)

      fireEvent.press(getByTestId("recipient"))

      expect(copiedContents()).toEqual(["alice"])
    })
  })

  describe("row surface", () => {
    it("keeps the copy rows surfaceInteractive and paints a row without icons surfaceStatic", () => {
      const { getAllByTestId, getByText } = renderScreenWithTx(
        broadcastedOnChainTx(ONCHAIN_TX_HASH),
      )

      expect(surfaceColor(getByText("some description"))).toBe("#f5f5f5")
      expect(surfaceColor(getAllByTestId("copy-paste")[0])).toBe("#f5f5f5")
      expect(surfaceColor(getByText("OnChain"))).toBe("#f9f9f9")
    })
  })
})
