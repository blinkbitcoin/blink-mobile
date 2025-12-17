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

  it("navigates to transactionDetail using latest tx id", () => {
    const { result } = renderHook(() =>
      useUnseenTxAmountBadge({
        transactions: [tx({ id: "navigate-me", createdAt: 10 })],
        hasUnseenBtcTx: true,
        hasUnseenUsdTx: false,
      }),
    )

    result.current.handleUnseenBadgePress()

    expect(mockNavigate).toHaveBeenCalledWith("transactionDetail", {
      txid: "navigate-me",
    })
  })
})
