import React from "react"

import { render } from "@testing-library/react-native"
import { renderHook } from "@testing-library/react-hooks"

import { TransactionDetailScreen } from "@app/screens/transaction-detail-screen/transaction-detail-screen"
import { useTransactionSeenState } from "@app/hooks/use-transaction-seen-state"
import { markTxLastSeenId } from "@app/graphql/client-only-query"
import {
  defaultPersistentState,
  type PersistentState,
} from "@app/store/persistent-state/state-migrations"
import { getTxLastSeenIds } from "@app/store/persistent-state/tx-last-seen"
import { NormalizedTransaction, PaymentType } from "@app/types/transaction"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = { grey5: "#f5f5f5", black: "#000" }
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
jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: () => null,
}))
jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: () => null,
}))
jest.mock("@app/components/transaction-item", () => ({
  useDescriptionDisplay: () => "some description",
}))

const mockUseFragment = jest.fn()
const mockApolloClient = { readQuery: jest.fn() }
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useFragment: () => mockUseFragment(),
  useApolloClient: () => mockApolloClient,
}))

jest.mock("@app/graphql/generated", () => ({
  HomeAuthedDocument: {},
  TransactionFragmentDoc: {},
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  TxStatus: { Pending: "PENDING", Failure: "FAILURE", Success: "SUCCESS" },
  TxDirection: { Receive: "RECEIVE", Send: "SEND" },
  useTransactionListForDefaultAccountLazyQuery: () => [jest.fn()],
  useHomeAuthedQuery: () => ({ data: { me: { defaultAccount: { id: "account-id" } } } }),
  useTxLastSeenQuery: () => ({ data: { txLastSeen: { btcId: "", usdId: "" } } }),
}))

jest.mock("@app/graphql/client-only-query", () => ({ markTxLastSeenId: jest.fn() }))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ feeReimbursementMemo: "fee reimbursement" }),
}))

/** The screen reads the seen state through the barrel; only that hook stays real here. */
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
  useTransactionSeenState: jest.requireActual("@app/hooks/use-transaction-seen-state")
    .useTransactionSeenState,
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: () => "1,000 sats",
    formatCurrency: () => "$1.00",
  }),
}))

jest.mock("@app/hooks/use-resolve-transaction-account", () => ({
  useResolveTransactionAccount: () => ({ status: "resolved", retry: jest.fn() }),
}))

const mockActiveWallet = { isSelfCustodial: true }
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet,
}))

const mockSelfCustodialWallet: { allTransactions: NormalizedTransaction[] } = {
  allTransactions: [],
}
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet,
}))

const mockSelfCustodialFragments = jest.fn()
jest.mock("@app/self-custodial/hooks/use-self-custodial-transaction-fragments", () => ({
  useSelfCustodialTransactionFragments: (transactions: unknown) =>
    mockSelfCustodialFragments(transactions),
}))

let mockPersistentState: PersistentState
const mockUpdateState = jest.fn((updater: (prev: PersistentState) => PersistentState) => {
  mockPersistentState = updater(mockPersistentState)
})
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({}) }))

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
        tryAgain: LLText,
      },
      TransactionDetailScreen: {
        received: LLText,
        sending: LLText,
        spent: LLText,
        paid: LLText,
        receivingAccount: LLText,
        sendingAccount: LLText,
        txNotBroadcast: LLText,
        findingAccount: LLText,
        txNotFoundInAccounts: LLText,
        txLoadFailed: LLText,
      },
    },
    locale: "en",
  }),
}))

type Fragment = {
  id: string
  createdAt: number
  settlementCurrency: string
  settlementAmount: number
}

const buildFragment = (
  id: string,
  createdAt: number,
  settlementCurrency: string,
): Fragment => ({
  id,
  createdAt,
  settlementCurrency,
  settlementAmount: 1000,
})

const BTC_OLD = buildFragment("sc-btc-old", 1, "BTC")
const BTC_NEW = buildFragment("sc-btc-new", 5, "BTC")
const USD_NEW = buildFragment("sc-usd-new", 3, "USD")
const SELF_CUSTODIAL_FRAGMENTS = [BTC_OLD, BTC_NEW, USD_NEW]

const SELF_CUSTODIAL_ACCOUNT_ID = "self-custodial-account"

const buildWalletTransaction = (id: string): NormalizedTransaction =>
  ({ id, paymentType: PaymentType.Spark }) as NormalizedTransaction

const renderDetail = (txid: string) => {
  mockUseFragment.mockReturnValue({
    data: {
      __typename: "Transaction",
      id: txid,
      settlementCurrency: txid.includes("usd") ? "USD" : "BTC",
      settlementAmount: 1000,
      settlementFee: 0,
      settlementDisplayFee: "0",
      settlementDisplayAmount: "1.00",
      settlementDisplayCurrency: "USD",
      settlementVia: { __typename: "SettlementViaLn", preImage: null },
      initiationVia: {
        __typename: "InitiationViaLn",
        paymentHash: "",
        paymentRequest: "",
      },
      direction: "RECEIVE",
      createdAt: 5,
      status: "SUCCESS",
    },
  })

  return render(
    <TransactionDetailScreen
      route={{ key: "detail", name: "transactionDetail", params: { txid } } as never}
    />,
  )
}

describe("TransactionDetailScreen seen state", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveWallet.isSelfCustodial = true
    mockSelfCustodialWallet.allTransactions = []
    mockApolloClient.readQuery.mockReturnValue(null)
    mockSelfCustodialFragments.mockReturnValue([])
    mockPersistentState = {
      ...defaultPersistentState,
      activeAccountId: SELF_CUSTODIAL_ACCOUNT_ID,
    }
  })

  describe("self-custodial account", () => {
    const walletTransactions = [
      buildWalletTransaction("sc-btc-old"),
      buildWalletTransaction("sc-btc-new"),
      buildWalletTransaction("sc-usd-new"),
    ]

    beforeEach(() => {
      mockSelfCustodialWallet.allTransactions = walletTransactions
      mockSelfCustodialFragments.mockReturnValue(SELF_CUSTODIAL_FRAGMENTS)
    })

    it("maps the same wallet list home reads, so both resolve the same newest tx", () => {
      renderDetail("sc-btc-new")

      expect(mockSelfCustodialFragments).toHaveBeenCalledWith(walletTransactions)
    })

    it("marks the newest transaction as seen on device when it is the one opened", () => {
      renderDetail("sc-btc-new")

      expect(getTxLastSeenIds(mockPersistentState)).toEqual({
        btcId: "sc-btc-new",
        usdId: "",
      })
      expect(markTxLastSeenId).not.toHaveBeenCalled()
    })

    it("clears the home badge for the same account once the detail marked it seen", () => {
      renderDetail("sc-btc-new")

      const { result } = renderHook(() =>
        useTransactionSeenState({
          accountId: "",
          isSelfCustodial: true,
          transactions: SELF_CUSTODIAL_FRAGMENTS as never,
        }),
      )

      expect(result.current.hasUnseenBtcTx).toBe(false)
      expect(result.current.hasUnseenUsdTx).toBe(true)
    })

    it("leaves an older transaction unseen so the badge keeps pointing at the newest", () => {
      renderDetail("sc-btc-old")

      expect(mockUpdateState).not.toHaveBeenCalled()
      expect(getTxLastSeenIds(mockPersistentState)).toEqual({ btcId: "", usdId: "" })
    })

    it("marks the currency of the transaction that was opened", () => {
      renderDetail("sc-usd-new")

      expect(getTxLastSeenIds(mockPersistentState)).toEqual({
        btcId: "",
        usdId: "sc-usd-new",
      })
    })
  })

  describe("custodial account", () => {
    beforeEach(() => {
      mockActiveWallet.isSelfCustodial = false
      mockSelfCustodialWallet.allTransactions = [buildWalletTransaction("ignored")]
      mockApolloClient.readQuery.mockReturnValue({
        me: {
          defaultAccount: {
            pendingIncomingTransactions: [],
            transactions: {
              edges: [
                { node: { ...BTC_NEW, status: "SUCCESS", direction: "RECEIVE" } },
                { node: { ...BTC_OLD, status: "SUCCESS", direction: "RECEIVE" } },
              ],
            },
          },
        },
      })
    })

    it("never maps wallet transactions", () => {
      renderDetail("sc-btc-new")

      expect(mockSelfCustodialFragments).toHaveBeenCalledWith([])
    })

    it("marks seen through the Apollo cache instead of the device store", () => {
      renderDetail("sc-btc-new")

      expect(markTxLastSeenId).toHaveBeenCalledWith({
        client: mockApolloClient,
        accountId: "account-id",
        currency: "BTC",
        id: "sc-btc-new",
      })
      expect(mockUpdateState).not.toHaveBeenCalled()
    })
  })
})
