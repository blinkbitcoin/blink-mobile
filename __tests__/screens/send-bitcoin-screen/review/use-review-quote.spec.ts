import { act, renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useReviewQuote } from "@app/screens/send-bitcoin-screen/review/use-review-quote"
import { FeeType } from "@app/screens/send-bitcoin-screen/use-fee"
import { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"

const mockUseFee = jest.fn<FeeType, [unknown, number | undefined]>()
jest.mock("@app/screens/send-bitcoin-screen/use-fee", () => ({
  __esModule: true,
  default: (getFee: unknown, quoteRound?: number) => mockUseFee(getFee, quoteRound),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const getFee = jest.fn()
const settlementAmount = toBtcMoneyAmount(1000)

/** Converts sats to cents at 1:2, so a fee converted into the settlement currency is
 *  told apart from one used as it came. */
const convertMoneyAmount = jest.fn((amount, currency) =>
  currency === WalletCurrency.Btc && amount.currency === WalletCurrency.Usd
    ? toBtcMoneyAmount(amount.amount * 2)
    : amount,
)

const detail = (isFeeIncluded?: boolean) =>
  ({
    getFee,
    settlementAmount,
    convertMoneyAmount,
    isFeeIncluded,
  }) as unknown as PaymentDetail<WalletCurrency>

const run = (isFeeIncluded?: boolean) =>
  renderHook(() => useReviewQuote(detail(isFeeIncluded))).result.current

describe("useReviewQuote", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("quotes the fee from the payment's own getFee", () => {
    mockUseFee.mockReturnValue({ status: "loading" })

    const { fee } = run()

    expect(mockUseFee).toHaveBeenCalledWith(getFee, 0)
    expect(fee).toEqual({ status: "loading" })
  })

  it("leads with the amount, never waiting, when the fee is on top of it", () => {
    mockUseFee.mockReturnValue({ status: "set", amount: toBtcMoneyAmount(50) })

    expect(run()).toMatchObject({
      recipientAmount: settlementAmount,
      isAwaitingIncludedFee: false,
    })
  })

  it("waits for the quote when the fee comes out of the amount", () => {
    mockUseFee.mockReturnValue({ status: "loading" })

    expect(run(true)).toMatchObject({
      recipientAmount: settlementAmount,
      isAwaitingIncludedFee: true,
    })
  })

  it("still waits when the quote for an included fee failed", () => {
    mockUseFee.mockReturnValue({ status: "error" })

    expect(run(true).isAwaitingIncludedFee).toBe(true)
  })

  it("leads with the amount less the fee, in the settlement currency, once quoted", () => {
    mockUseFee.mockReturnValue({ status: "set", amount: toUsdMoneyAmount(50) })

    const { recipientAmount, isAwaitingIncludedFee } = run(true)

    expect(convertMoneyAmount).toHaveBeenCalledWith(
      toUsdMoneyAmount(50),
      WalletCurrency.Btc,
    )
    expect(recipientAmount).toMatchObject({ amount: 900, currency: WalletCurrency.Btc })
    expect(isAwaitingIncludedFee).toBe(false)
  })

  it("holds the send, and shows nothing below zero, when the fee would take the whole amount", () => {
    mockUseFee.mockReturnValue({ status: "set", amount: toBtcMoneyAmount(1200) })

    const { recipientAmount, isFeeOverAmount } = run(true)

    expect(recipientAmount).toMatchObject({ amount: 0, currency: WalletCurrency.Btc })
    expect(isFeeOverAmount).toBe(true)
  })

  it("never holds the send for a fee that leaves something, or one paid on top", () => {
    mockUseFee.mockReturnValue({ status: "set", amount: toBtcMoneyAmount(999) })
    expect(run(true).isFeeOverAmount).toBe(false)

    mockUseFee.mockReturnValue({ status: "set", amount: toBtcMoneyAmount(5000) })
    expect(run().isFeeOverAmount).toBe(false)
  })

  /** blink-wip#2048 E4: a send-all whose quote moved since review sent nothing. */
  it("quotes again on requote, with a toast asking the sender to look", () => {
    mockUseFee.mockReturnValue({ status: "loading" })
    const { result } = renderHook(() => useReviewQuote(detail(true)))

    act(() => result.current.requote())

    expect(mockUseFee).toHaveBeenLastCalledWith(getFee, 1)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning" }),
    )
  })
})
