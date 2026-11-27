import { act, renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { useSettledAmountText } from "@app/screens/send-bitcoin-screen/review/use-settled-amount-text"
import { DisplayCurrency, MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

/** Writes an amount with its currency, so each text says which one it was built from. */
const mockFormat = ({
  moneyAmount,
}: {
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
}) => `${moneyAmount.amount} ${moneyAmount.currency}`

jest.mock("@app/hooks", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: mockFormat,
    /** The other side of the pair: the wallet amount under a display primary, and back. */
    getSecondaryAmountIfCurrencyIsDifferent: ({
      primaryAmount,
      walletAmount,
      displayAmount,
    }: Record<string, MoneyAmount<WalletOrDisplayCurrency>>) =>
      primaryAmount.currency === "DisplayCurrency" ? walletAmount : displayAmount,
  }),
}))

/** Two display units to the sat, so a converted amount is told apart from one as sent. */
const paymentDetail = {
  sendingWalletDescriptor: { id: "btc-wallet-id", currency: WalletCurrency.Btc },
  convertMoneyAmount: (
    amount: MoneyAmount<WalletOrDisplayCurrency>,
    currency: string,
  ) => ({
    amount: currency === DisplayCurrency ? amount.amount * 2 : amount.amount,
    currency,
    currencyCode: currency,
  }),
} as unknown as PaymentDetail<WalletCurrency>

const quoted = { heroPrimaryText: "1800 DisplayCurrency", heroSecondaryText: "900 BTC" }
const settled = { amountSats: 880, feeSats: 120 }

const render = (leadsWithWalletCurrency: boolean) =>
  renderHook(() => useSettledAmountText(paymentDetail, leadsWithWalletCurrency, quoted))

describe("useSettledAmountText", () => {
  it("shows review's quote until a send settles", () => {
    expect(render(false).result.current.hero).toEqual(quoted)
  })

  it("settles the hero and receipt on what went out, led by the display currency", () => {
    const { result } = render(false)

    let text: ReturnType<typeof result.current.settle> | undefined
    act(() => {
      text = result.current.settle(settled)
    })

    expect(text).toEqual({
      heroPrimaryText: "1760 DisplayCurrency",
      heroSecondaryText: "880 BTC",
      receipt: {
        currencyAmount: "1760 DisplayCurrency",
        satAmount: "880 BTC",
        currencyFeeAmount: "240 DisplayCurrency",
        satFeeAmount: "120 BTC",
      },
    })
    expect(result.current.hero).toMatchObject({
      heroPrimaryText: "1760 DisplayCurrency",
      heroSecondaryText: "880 BTC",
    })
  })

  it("leads the hero with the wallet currency when the sender typed in it", () => {
    const { result } = render(true)

    act(() => {
      result.current.settle(settled)
    })

    expect(result.current.hero).toMatchObject({
      heroPrimaryText: "880 BTC",
      heroSecondaryText: "1760 DisplayCurrency",
    })
  })

  it("keeps review's texts, and no receipt, when the send reported nothing", () => {
    const { result } = render(false)

    let text: ReturnType<typeof result.current.settle> | undefined
    act(() => {
      text = result.current.settle(undefined)
    })

    expect(text).toEqual(quoted)
    expect(result.current.hero).toEqual(quoted)
  })
})
