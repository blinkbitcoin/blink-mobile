import React from "react"

import { fireEvent, render } from "@testing-library/react-native"
import { Linking } from "react-native"

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

jest.mock("@app/screens/send-bitcoin-screen/amount-entry/send-wallet-summary", () => ({
  SendWalletSummary: () => null,
}))

jest.mock("@app/components/transaction-date", () => ({
  TransactionDate: () => null,
  formatDateForTransaction: () => "24 Jul 2024, 06:26",
}))

jest.mock("@app/components/atomic/galoy-info", () => ({
  GaloyInfo: () => null,
}))

jest.mock("@app/components/transaction-item", () => ({
  useDescriptionDisplay: () => "some description",
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

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: false, wallets: [] }),
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
    "TransactionDetailScreen.copyAllData": "copy-all",
  }),
)

const ONCHAIN_TX_HASH = "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"
const SPARK_TX_ID = "0196fe12-7fca-7d55-8d9d-1af6f9f0e7b9"
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

const broadcastedOnChainTx = (transactionHash: string) => ({
  data: {
    ...baseTx,
    settlementVia: {
      __typename: "SettlementViaOnChain",
      transactionHash,
      arrivalInMempoolEstimatedAt: null,
    },
    initiationVia: { __typename: "InitiationViaOnChain", address: "" },
  },
})

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

// Regression guards for the #3732 / #3898 row actions: the copy icons are gone,
// but tapping a row still copies its value, and tapping the on-chain
// transaction ID opens it on the explorer (a long press copies it).
describe("TransactionDetailScreen row actions", () => {
  const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)

  beforeEach(() => {
    openURLSpy.mockClear()
    mockCopyToClipboard.mockClear()
  })

  const renderExpanded = (tx: unknown) => {
    const screen = renderScreenWithTx(tx)
    fireEvent.press(screen.getByTestId("advanced"))
    return screen
  }

  describe("broadcasted onchain transaction", () => {
    it("opens the hex transaction hash on the block explorer", () => {
      const { getByTestId } = renderExpanded(broadcastedOnChainTx(ONCHAIN_TX_HASH))

      fireEvent.press(getByTestId("transaction-id"))

      expect(openURLSpy).toHaveBeenCalledWith(
        "https://mempool.space/tx/" + ONCHAIN_TX_HASH,
      )
    })

    it("opens a spark transaction (UUID hash with dashes) on the spark explorer", () => {
      const { getByTestId } = renderExpanded(broadcastedOnChainTx(SPARK_TX_ID))

      fireEvent.press(getByTestId("transaction-id"))

      expect(openURLSpy).toHaveBeenCalledWith("https://sparkscan.io/tx/" + SPARK_TX_ID)
    })

    it("copies the transaction hash, description and internal id", () => {
      const { getByTestId } = renderExpanded(broadcastedOnChainTx(ONCHAIN_TX_HASH))

      fireEvent(getByTestId("transaction-id"), "longPress")
      fireEvent.press(getByTestId("note"))
      fireEvent.press(getByTestId("internal-id"))

      expect(copiedContents()).toEqual([ONCHAIN_TX_HASH, "some description", TX_ID])
      expect(openURLSpy).not.toHaveBeenCalled()
    })
  })

  describe("lightning transaction", () => {
    it("opens the payment request in the lightning decoder", () => {
      const { getByTestId } = renderExpanded(lightningTx)

      fireEvent.press(getByTestId("payment-request"))

      expect(openURLSpy).toHaveBeenCalledWith(
        "https://dev.blink.sv/decode?invoice=" + LN_PAYMENT_REQUEST,
      )
    })

    it("copies description, payment hash, preimage, payment request and internal id", () => {
      const { getByTestId } = renderExpanded(lightningTx)

      fireEvent.press(getByTestId("note"))
      fireEvent.press(getByTestId("hash"))
      fireEvent.press(getByTestId("preimage"))
      fireEvent(getByTestId("payment-request"), "longPress")
      fireEvent.press(getByTestId("internal-id"))

      expect(copiedContents()).toEqual([
        "some description",
        LN_PAYMENT_HASH,
        LN_PRE_IMAGE,
        LN_PAYMENT_REQUEST,
        TX_ID,
      ])
      expect(openURLSpy).not.toHaveBeenCalled()
    })

    it("copies every row as one block, in screen order", () => {
      const { getByLabelText } = renderExpanded(lightningTx)

      fireEvent.press(getByLabelText("copy-all"))

      const lines = copiedContents()[0].split("\n")
      const at = (line: string) => lines.indexOf(line)
      expect(lines).toContain(": 24 Jul 2024, 06:26")
      expect(at("note: some description")).toBeGreaterThan(-1)
      expect(at(`hash: ${LN_PAYMENT_HASH}`)).toBeGreaterThan(at("note: some description"))
      expect(at(`preimage: ${LN_PRE_IMAGE}`)).toBeGreaterThan(
        at(`hash: ${LN_PAYMENT_HASH}`),
      )
      expect(at(`payment-request: ${LN_PAYMENT_REQUEST}`)).toBeGreaterThan(
        at(`preimage: ${LN_PRE_IMAGE}`),
      )
      expect(lines[lines.length - 1]).toBe(`internal-id: ${TX_ID}`)
    })

    it("keeps the technical rows folded away until Advanced is opened", () => {
      const { queryByTestId } = renderScreenWithTx(lightningTx)

      expect(queryByTestId("hash")).toBeNull()
      expect(queryByTestId("payment-request")).toBeNull()
    })
  })
})
