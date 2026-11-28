import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useConvertMoneyDetails } from "@app/screens/conversion-flow/use-convert-money-details"

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: (moneyAmount: { amount: number }, currency: WalletCurrency) => ({
      amount: moneyAmount.amount,
      currency,
      currencyCode: currency,
    }),
    convertMoneyAmountWithRounding: (
      moneyAmount: { amount: number },
      currency: WalletCurrency,
    ) => ({ amount: moneyAmount.amount, currency, currencyCode: currency }),
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    zeroDisplayAmount: { amount: 0, currency: "DisplayCurrency", currencyCode: "USD" },
  }),
}))

const emptyBtc = { id: "btc-wallet", balance: 0, walletCurrency: WalletCurrency.Btc }
const card = { id: "card-1", balance: 125000, walletCurrency: WalletCurrency.Btc }

describe("useConvertMoneyDetails", () => {
  it("swaps an empty source for the other side, as it always has", () => {
    const { result } = renderHook(() =>
      useConvertMoneyDetails({ initialFromWallet: emptyBtc, initialToWallet: card }),
    )

    expect(result.current.fromWallet).toEqual(card)
    expect(result.current.toWallet).toEqual(emptyBtc)
  })

  it("keeps a fixed direction even from an empty source", () => {
    const { result } = renderHook(() =>
      useConvertMoneyDetails({
        initialFromWallet: emptyBtc,
        initialToWallet: card,
        isDirectionFixed: true,
      }),
    )

    expect(result.current.fromWallet).toEqual(emptyBtc)
    expect(result.current.toWallet).toEqual(card)
  })

  it("keeps the extra fields of each side", () => {
    const btcSide = { ...emptyBtc, balance: 22, kind: "BTC" }
    const cardSide = { ...card, kind: "CARD" }
    const { result } = renderHook(() =>
      useConvertMoneyDetails({ initialFromWallet: btcSide, initialToWallet: cardSide }),
    )

    expect(result.current.toWallet?.kind).toBe("CARD")
  })
})
