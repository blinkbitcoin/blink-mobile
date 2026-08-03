import { renderHook } from "@testing-library/react-native"

import {
  TransactionFragment,
  TxDirection,
  TxStatus,
  WalletCurrency,
} from "@app/graphql/generated"
import { useUnseenTxBadgeState } from "@app/components/unseen-tx-amount-badge/use-unseen-tx-badge-state"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"

const mockSeenState = jest.fn()
const mockAmountBadge = jest.fn()
const mockFragments = jest.fn()
const mockOutgoingVisibility = jest.fn()
const mockIncomingVisibility = jest.fn()
const mockMarkTxSeen = jest.fn()

jest.mock("@app/hooks/use-transaction-seen-state", () => ({
  useTransactionSeenState: (accountId: string, transactions: unknown) =>
    mockSeenState(accountId, transactions),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-transaction-fragments", () => ({
  useSelfCustodialTransactionFragments: (transactions: unknown) =>
    mockFragments(transactions),
}))

jest.mock("@app/components/unseen-tx-amount-badge/use-unseen-tx-amount-badge", () => ({
  useUnseenTxAmountBadge: (params: unknown) => mockAmountBadge(params),
}))

jest.mock("@app/components/unseen-tx-amount-badge/use-outgoing-badge-visibility", () => ({
  useOutgoingBadgeVisibility: (params: unknown) => mockOutgoingVisibility(params),
}))

jest.mock("@app/components/unseen-tx-amount-badge/use-incoming-badge-auto-seen", () => ({
  useIncomingBadgeAutoSeen: (params: unknown) => mockIncomingVisibility(params),
}))

const CUSTODIAL_ACCOUNT_ID = "custodial-account"
const SELF_CUSTODIAL_ACCOUNT_ID = "self-custodial-account"

const makeSelfCustodialTransaction = (): NormalizedTransaction => ({
  id: "sc-tx",
  amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  direction: TransactionDirection.Receive,
  status: TransactionStatus.Completed,
  timestamp: 1747691078,
  paymentType: PaymentType.Lightning,
})

const makeCustodialFragment = (
  id: string,
  overrides: Partial<TransactionFragment> = {},
): TransactionFragment => ({
  __typename: "Transaction",
  id,
  status: TxStatus.Success,
  direction: TxDirection.Receive,
  memo: null,
  createdAt: 1747691078,
  settlementAmount: 100,
  settlementFee: 0,
  settlementDisplayFee: "0",
  settlementCurrency: WalletCurrency.Btc,
  settlementDisplayAmount: "0.06",
  settlementDisplayCurrency: "USD",
  settlementPrice: {
    __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
    base: 0,
    offset: 0,
    currencyUnit: "USD",
    formattedAmount: "0",
  },
  initiationVia: {
    __typename: "InitiationViaLn",
    paymentHash: `hash-${id}`,
    paymentRequest: "",
  },
  settlementVia: { __typename: "SettlementViaLn", preImage: null },
  ...overrides,
})

const renderBadgeState = (
  overrides: Partial<Parameters<typeof useUnseenTxBadgeState>[0]> = {},
) =>
  renderHook(() =>
    useUnseenTxBadgeState({
      isSelfCustodial: false,
      isFocused: true,
      custodialAccountId: CUSTODIAL_ACCOUNT_ID,
      selfCustodialAccountId: SELF_CUSTODIAL_ACCOUNT_ID,
      selfCustodialTransactions: [],
      pendingIncomingTransactions: null,
      transactionEdges: null,
      ...overrides,
    }),
  )

describe("useUnseenTxBadgeState", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFragments.mockReturnValue([])
    mockSeenState.mockReturnValue({
      hasUnseenBtcTx: false,
      hasUnseenUsdTx: false,
      markTxSeen: mockMarkTxSeen,
    })
    mockAmountBadge.mockReturnValue({
      latestUnseenTx: undefined,
      unseenAmountText: null,
      handleUnseenBadgePress: jest.fn(),
      isOutgoing: false,
    })
    mockOutgoingVisibility.mockReturnValue(false)
    mockIncomingVisibility.mockReturnValue(true)
  })

  describe("custodial account", () => {
    it("feeds the badge with the transactions from the home query", () => {
      renderBadgeState({
        pendingIncomingTransactions: [
          makeCustodialFragment("pending", { status: TxStatus.Pending }),
        ],
        transactionEdges: [{ node: makeCustodialFragment("settled") }],
      })

      const [, transactions] = mockSeenState.mock.calls[0]
      expect(transactions.map((tx: { id: string }) => tx.id)).toEqual([
        "pending",
        "settled",
      ])
    })

    it("leaves out an incoming transaction that is still pending", () => {
      renderBadgeState({
        transactionEdges: [
          { node: makeCustodialFragment("settled") },
          {
            node: makeCustodialFragment("pending-incoming", { status: TxStatus.Pending }),
          },
        ],
      })

      const [, transactions] = mockSeenState.mock.calls[0]
      expect(transactions.map((tx: { id: string }) => tx.id)).toEqual(["settled"])
    })

    it("keeps an outgoing transaction that is still pending", () => {
      const pendingSend = makeCustodialFragment("pending-send", {
        status: TxStatus.Pending,
        direction: TxDirection.Send,
      })

      renderBadgeState({ transactionEdges: [{ node: pendingSend }] })

      const [, transactions] = mockSeenState.mock.calls[0]
      expect(transactions.map((tx: { id: string }) => tx.id)).toEqual(["pending-send"])
    })

    it("keys the seen state by the custodial account", () => {
      renderBadgeState()

      expect(mockSeenState).toHaveBeenCalledWith(CUSTODIAL_ACCOUNT_ID, [])
    })

    it("never maps self-custodial transactions", () => {
      renderBadgeState({ selfCustodialTransactions: [makeSelfCustodialTransaction()] })

      expect(mockFragments).toHaveBeenCalledWith([])
    })
  })

  describe("self-custodial account", () => {
    it("feeds the badge with the mapped wallet transactions", () => {
      const mapped = [makeCustodialFragment("sc-tx")]
      mockFragments.mockReturnValue(mapped)

      renderBadgeState({
        isSelfCustodial: true,
        selfCustodialTransactions: [makeSelfCustodialTransaction()],
      })

      expect(mockFragments).toHaveBeenCalledWith([makeSelfCustodialTransaction()])
      expect(mockSeenState).toHaveBeenCalledWith(SELF_CUSTODIAL_ACCOUNT_ID, mapped)
    })

    it("ignores whatever the custodial home query returned", () => {
      mockFragments.mockReturnValue([])

      renderBadgeState({
        isSelfCustodial: true,
        transactionEdges: [{ node: makeCustodialFragment("custodial-tx") }],
      })

      expect(mockSeenState).toHaveBeenCalledWith(SELF_CUSTODIAL_ACCOUNT_ID, [])
    })

    it("falls back to an empty account key while the account is still loading", () => {
      renderBadgeState({ isSelfCustodial: true, selfCustodialAccountId: undefined })

      expect(mockSeenState).toHaveBeenCalledWith("", [])
    })
  })

  it("marks the unseen currency as seen when the outgoing badge hides", () => {
    mockAmountBadge.mockReturnValue({
      latestUnseenTx: { id: "tx-1", settlementCurrency: WalletCurrency.Usd },
      unseenAmountText: "+$1.00",
      handleUnseenBadgePress: jest.fn(),
      isOutgoing: true,
    })

    renderBadgeState()

    const [{ onHide }] = mockOutgoingVisibility.mock.calls[0]
    onHide()

    expect(mockMarkTxSeen).toHaveBeenCalledWith(WalletCurrency.Usd)
  })

  it("does not mark anything as seen without an unseen transaction", () => {
    renderBadgeState()

    const [{ onHide }] = mockOutgoingVisibility.mock.calls[0]
    onHide()

    expect(mockMarkTxSeen).not.toHaveBeenCalled()
  })

  it("exposes what the home screen renders", () => {
    const handleUnseenBadgePress = jest.fn()
    mockAmountBadge.mockReturnValue({
      latestUnseenTx: { id: "tx-1", settlementCurrency: WalletCurrency.Btc },
      unseenAmountText: "+1,000 sats",
      handleUnseenBadgePress,
      isOutgoing: false,
    })
    mockSeenState.mockReturnValue({
      hasUnseenBtcTx: true,
      hasUnseenUsdTx: false,
      markTxSeen: mockMarkTxSeen,
    })
    mockFragments.mockReturnValue([makeCustodialFragment("sc-tx")])

    const { result } = renderBadgeState({ isSelfCustodial: true })

    expect(result.current).toMatchObject({
      hasUnseenBtcTx: true,
      hasUnseenUsdTx: false,
      unseenAmountText: "+1,000 sats",
      handleUnseenBadgePress,
      showIncomingBadge: true,
      showOutgoingBadge: false,
      isOutgoing: false,
      latestUnseenTxId: "tx-1",
      transactionCount: 1,
    })
  })
})
