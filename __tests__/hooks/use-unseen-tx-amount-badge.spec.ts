import { renderHook } from "@testing-library/react-hooks"

import { TxDirection, type TransactionFragment } from "@app/graphql/generated"
import { useUnseenTxAmountBadge } from "@app/components/unseen-tx-amount-badge"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  return {
    useNavigation: () => ({ navigate: mockNavigate }),
  }
})

type FormatCurrencyArgs = {
  amountInMajorUnits: string
  currency: string
}

type FormatMoneyAmountArgs = {
  moneyAmount: { amount: number; currency: string }
}

jest.mock("@app/hooks", () => {
  return {
    useDisplayCurrency: () => ({
      formatCurrency: ({ amountInMajorUnits, currency }: FormatCurrencyArgs) =>
        `${currency} ${amountInMajorUnits}`,
      formatMoneyAmount: ({ moneyAmount }: FormatMoneyAmountArgs) =>
        `${moneyAmount.currency} ${moneyAmount.amount}`,
    }),
  }
})

type ToWalletAmountArgs = {
  amount: number
  currency: string
}

jest.mock("@app/types/amounts", () => {
  return {
    toWalletAmount: ({ amount, currency }: ToWalletAmountArgs) => ({ amount, currency }),
  }
})

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    feeReimbursementMemo: "fee reimbursement",
  }),
}))

const mockReadQuery = jest.fn(() => null as unknown)

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({
    readQuery: mockReadQuery,
  }),
}))

const tx = (overrides: Partial<TransactionFragment>): TransactionFragment =>
  ({
    __typename: "Transaction",
    id: "txid",
    status: "SUCCESS",
    createdAt: 0,
    direction: TxDirection.Receive,
    settlementAmount: 123,
    settlementFee: 0,
    settlementDisplayFee: "",
    settlementCurrency: "BTC",
    settlementDisplayAmount: "",
    settlementDisplayCurrency: "",
    settlementPrice: {
      __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
      base: 0,
      offset: 0,
      currencyUnit: "",
      formattedAmount: "",
    },
    initiationVia: {
      __typename: "InitiationViaLn",
      paymentHash: "",
      paymentRequest: "",
    },
    settlementVia: {
      __typename: "SettlementViaLn",
      preImage: null,
    },
    ...overrides,
  }) as TransactionFragment

describe("useUnseenTxAmountBadge", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("falls back to the cached custodial transactions when none are provided", () => {
    mockReadQuery.mockReturnValue({
      me: {
        defaultAccount: {
          pendingIncomingTransactions: [tx({ id: "cached", createdAt: 9 })],
          transactions: { edges: [] },
        },
      },
    })

    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    expect(result.current.latestUnseenTx?.id).toBe("cached")
  })

  it("never reads the custodial cache for a self-custodial account", () => {
    mockReadQuery.mockReturnValue({
      me: {
        defaultAccount: {
          pendingIncomingTransactions: [tx({ id: "cached", createdAt: 9 })],
          transactions: { edges: [] },
        },
      },
    })

    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [],
        isSelfCustodial: true,
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    expect(mockReadQuery).not.toHaveBeenCalled()
    expect(result.current.latestUnseenTx).toBeUndefined()
  })

  it("returns null when nothing unseen", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [tx({ id: "a", createdAt: 1 })],
        hasUnseenBtcTx: false,
        hasUnseenUsdTx: false,
      }),
    )

    expect(result.current.latestUnseenTx).toBeUndefined()
    expect(result.current.unseenAmountText).toBeNull()
  })

  /** The badge and the seen state share one eligibility predicate, so a transaction the
   *  seen state never counts must not be the one the badge announces: a zero settlement
   *  has no amount to show, and a fee reimbursement echoes a send already announced. */
  it("announces nothing when the only unseen transactions are not announceable", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [
          tx({ id: "zero", createdAt: 1, settlementAmount: 0 }),
          tx({ id: "reimbursement", createdAt: 2, memo: "Fee Reimbursement" }),
        ],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    expect(result.current.latestUnseenTx).toBeUndefined()
    expect(result.current.unseenAmountText).toBeNull()
  })

  it("picks most recent by createdAt", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [tx({ id: "old", createdAt: 1 }), tx({ id: "new", createdAt: 2 })],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    expect(result.current.latestUnseenTx?.id).toBe("new")
  })

  it("keeps the most recent when the newest is not the last in the list", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [tx({ id: "new", createdAt: 2 }), tx({ id: "old", createdAt: 1 })],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    expect(result.current.latestUnseenTx?.id).toBe("new")
  })

  /** A transaction can be announceable and still have nothing printable: the badge shows a
   *  figure, so without one there is no badge to show. */
  it("announces no text when neither the display nor the raw amount can be formatted", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [
          tx({
            id: "unformattable",
            createdAt: 1,
            settlementAmount: null as unknown as number,
            settlementDisplayAmount: null as unknown as string,
            settlementDisplayCurrency: "",
          }),
        ],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    expect(result.current.latestUnseenTx?.id).toBe("unformattable")
    expect(result.current.unseenAmountText).toBeNull()
  })

  it("ignores currencies without unseen txs", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [
          tx({ id: "btc-latest", createdAt: 2, settlementCurrency: "BTC" }),
          tx({ id: "usd-latest", createdAt: 3, settlementCurrency: "USD" }),
        ],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    expect(result.current.latestUnseenTx?.id).toBe("btc-latest")
  })

  it("prefixes + for receive and not for send", () => {
    const { result: receiveResult } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [
          tx({
            id: "r",
            createdAt: 1,
            direction: TxDirection.Receive,
            settlementCurrency: "USD",
            settlementDisplayAmount: "5",
            settlementDisplayCurrency: "USD",
          }),
        ],
        hasUnseenBtcTx: false,
        hasUnseenUsdTx: true,
      }),
    )

    expect(receiveResult.current.unseenAmountText).toBe("+USD 5")

    const { result: sendResult } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [
          tx({
            id: "s",
            createdAt: 1,
            direction: TxDirection.Send,
            settlementAmount: 10,
            settlementCurrency: "BTC" as TransactionFragment["settlementCurrency"],
          }),
        ],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    expect(sendResult.current.unseenAmountText).toBe("BTC 10")
  })

  it("navigates to transactionDetail for the transaction it is given", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [tx({ id: "navigate-me", createdAt: 10 })],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    result.current.navigateToTransaction("navigate-me")

    expect(mockNavigate).toHaveBeenCalledWith("transactionDetail", {
      txid: "navigate-me",
    })
  })

  it("does not navigate without a transaction to open", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [],
        hasUnseenBtcTx: false,
        hasUnseenUsdTx: false,
      }),
    )

    result.current.navigateToTransaction("")

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
