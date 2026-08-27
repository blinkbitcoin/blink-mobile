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
const mockIncomingAutoSeen = jest.fn()
const mockNavigateToTransaction = jest.fn()
const mockMarkTxSeen = jest.fn()

jest.mock("@app/hooks/use-transaction-seen-state", () => ({
  useTransactionSeenState: (params: unknown) => mockSeenState(params),
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
  useIncomingBadgeAutoSeen: (params: unknown) => mockIncomingAutoSeen(params),
}))

const CUSTODIAL_ACCOUNT_ID = "custodial-account"

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
      navigateToTransaction: mockNavigateToTransaction,
      isOutgoing: false,
    })
    mockOutgoingVisibility.mockReturnValue(false)
    mockIncomingAutoSeen.mockReturnValue({ visible: true, announcement: null })
  })

  describe("custodial account", () => {
    it("feeds the badge with the transactions from the home query", () => {
      renderBadgeState({
        pendingIncomingTransactions: [
          makeCustodialFragment("pending", { status: TxStatus.Pending }),
        ],
        transactionEdges: [{ node: makeCustodialFragment("settled") }],
      })

      const [{ transactions }] = mockSeenState.mock.calls[0]
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

      const [{ transactions }] = mockSeenState.mock.calls[0]
      expect(transactions.map((tx: { id: string }) => tx.id)).toEqual(["settled"])
    })

    it("keeps an outgoing transaction that is still pending", () => {
      const pendingSend = makeCustodialFragment("pending-send", {
        status: TxStatus.Pending,
        direction: TxDirection.Send,
      })

      renderBadgeState({ transactionEdges: [{ node: pendingSend }] })

      const [{ transactions }] = mockSeenState.mock.calls[0]
      expect(transactions.map((tx: { id: string }) => tx.id)).toEqual(["pending-send"])
    })

    it("keys the seen state by the custodial account", () => {
      renderBadgeState()

      expect(mockSeenState).toHaveBeenCalledWith({
        accountId: CUSTODIAL_ACCOUNT_ID,
        isSelfCustodial: false,
        transactions: [],
      })
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
      const [{ transactions }] = mockSeenState.mock.calls[0]
      expect(transactions).toEqual(mapped)
    })

    it("ignores whatever the custodial home query returned", () => {
      mockFragments.mockReturnValue([])

      renderBadgeState({
        isSelfCustodial: true,
        transactionEdges: [{ node: makeCustodialFragment("custodial-tx") }],
      })

      const [{ transactions }] = mockSeenState.mock.calls[0]
      expect(transactions).toEqual([])
    })

    it("leaves the self-custodial seen-state key to the seen-state hook", () => {
      renderBadgeState({ isSelfCustodial: true, custodialAccountId: undefined })

      expect(mockSeenState).toHaveBeenCalledWith({
        accountId: "",
        isSelfCustodial: true,
        transactions: [],
      })
    })
  })

  it("marks the unseen currency as seen when the outgoing badge hides", () => {
    mockAmountBadge.mockReturnValue({
      latestUnseenTx: { id: "tx-1", settlementCurrency: WalletCurrency.Usd },
      unseenAmountText: "+$1.00",
      navigateToTransaction: mockNavigateToTransaction,
      isOutgoing: true,
    })

    renderBadgeState()

    const [{ onHide }] = mockOutgoingVisibility.mock.calls[0]
    onHide()

    expect(mockMarkTxSeen).toHaveBeenCalledWith(WalletCurrency.Usd)
  })

  /** A send replaced by a newer one before its timer fires is marked seen by the cleanup,
   *  which runs with the render that armed it. So the currency it marks is the one that
   *  was on screen, never the one that replaced it. */
  it("marks the superseded currency when a newer send replaces the badge", () => {
    mockAmountBadge.mockReturnValue({
      latestUnseenTx: { id: "tx-btc", settlementCurrency: WalletCurrency.Btc },
      unseenAmountText: "-0.001 BTC",
      navigateToTransaction: mockNavigateToTransaction,
      isOutgoing: true,
    })

    const { rerender } = renderBadgeState()

    mockAmountBadge.mockReturnValue({
      latestUnseenTx: { id: "tx-usd", settlementCurrency: WalletCurrency.Usd },
      unseenAmountText: "-$5.00",
      navigateToTransaction: mockNavigateToTransaction,
      isOutgoing: true,
    })
    rerender(undefined)

    const [{ onHide: hideSupersededBadge }] = mockOutgoingVisibility.mock.calls[0]
    hideSupersededBadge()

    expect(mockMarkTxSeen).toHaveBeenCalledWith(WalletCurrency.Btc)
  })

  it("does not mark anything as seen without an unseen transaction", () => {
    renderBadgeState()

    const [{ onHide }] = mockOutgoingVisibility.mock.calls[0]
    onHide()

    expect(mockMarkTxSeen).not.toHaveBeenCalled()
  })

  it("exposes what the home screen renders", () => {
    mockAmountBadge.mockReturnValue({
      latestUnseenTx: { id: "tx-1", settlementCurrency: WalletCurrency.Btc },
      unseenAmountText: "+1,000 sats",
      navigateToTransaction: mockNavigateToTransaction,
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
      showIncomingBadge: true,
      showOutgoingBadge: false,
      isOutgoing: false,
      latestUnseenTxId: "tx-1",
      transactionCount: 1,
    })
  })

  describe("an announced incoming badge", () => {
    const ANNOUNCEMENT = {
      txId: "announced-tx",
      currency: WalletCurrency.Btc,
      amountText: "+2,000 sats",
    }

    /** Marking seen on announcement empties the unseen state while the badge is still up,
     *  which is the state the home screen has to keep rendering from. */
    const renderAnnouncedBadge = () => {
      mockAmountBadge.mockReturnValue({
        latestUnseenTx: undefined,
        unseenAmountText: null,
        navigateToTransaction: mockNavigateToTransaction,
        isOutgoing: false,
      })
      mockIncomingAutoSeen.mockReturnValue({
        visible: true,
        announcement: ANNOUNCEMENT,
      })

      return renderBadgeState({ isSelfCustodial: true })
    }

    it("keeps showing the announced amount after its transaction is marked seen", () => {
      const { result } = renderAnnouncedBadge()

      expect(result.current.unseenAmountText).toBe("+2,000 sats")
      expect(result.current.latestUnseenTxId).toBe("announced-tx")
      expect(result.current.showIncomingBadge).toBe(true)
    })

    it("opens the announced transaction when the badge is pressed", () => {
      const { result } = renderAnnouncedBadge()

      result.current.handleUnseenBadgePress()

      expect(mockNavigateToTransaction).toHaveBeenCalledWith("announced-tx")
    })

    it("stays on the incoming branch even if an outgoing transaction becomes the newest unseen one", () => {
      mockAmountBadge.mockReturnValue({
        latestUnseenTx: { id: "outgoing-tx", settlementCurrency: WalletCurrency.Btc },
        unseenAmountText: "-500 sats",
        navigateToTransaction: mockNavigateToTransaction,
        isOutgoing: true,
      })
      mockIncomingAutoSeen.mockReturnValue({
        visible: true,
        announcement: ANNOUNCEMENT,
      })

      const { result } = renderBadgeState({ isSelfCustodial: true })

      expect(result.current.isOutgoing).toBe(false)
      expect(result.current.unseenAmountText).toBe("+2,000 sats")
    })

    it("parks the outgoing badge instead of letting it mark its transaction seen unpainted", () => {
      mockAmountBadge.mockReturnValue({
        latestUnseenTx: { id: "outgoing-tx", settlementCurrency: WalletCurrency.Btc },
        unseenAmountText: "-500 sats",
        navigateToTransaction: mockNavigateToTransaction,
        isOutgoing: true,
      })
      mockIncomingAutoSeen.mockReturnValue({
        visible: true,
        announcement: ANNOUNCEMENT,
      })

      renderBadgeState({ isSelfCustodial: true })

      const [outgoingParams] = mockOutgoingVisibility.mock.calls[0]
      expect(outgoingParams.isOutgoing).toBe(false)
      expect(outgoingParams.amountText).toBeNull()
      expect(outgoingParams.txId).toBeUndefined()
    })

    it("keeps the announced currency reading unseen so its wallet row stays marked", () => {
      mockSeenState.mockReturnValue({
        hasUnseenBtcTx: false,
        hasUnseenUsdTx: false,
        markTxSeen: mockMarkTxSeen,
      })
      mockIncomingAutoSeen.mockReturnValue({
        visible: true,
        announcement: ANNOUNCEMENT,
      })

      const { result } = renderBadgeState({ isSelfCustodial: true })

      expect(result.current.hasUnseenBtcTx).toBe(true)
      expect(result.current.hasUnseenUsdTx).toBe(false)
    })

    it("does not navigate once the announcement is released and nothing is unseen", () => {
      mockAmountBadge.mockReturnValue({
        latestUnseenTx: undefined,
        unseenAmountText: null,
        navigateToTransaction: mockNavigateToTransaction,
        isOutgoing: false,
      })
      mockIncomingAutoSeen.mockReturnValue({ visible: false, announcement: null })

      const { result } = renderBadgeState({ isSelfCustodial: true })
      result.current.handleUnseenBadgePress()

      expect(mockNavigateToTransaction).not.toHaveBeenCalled()
    })
  })
})
