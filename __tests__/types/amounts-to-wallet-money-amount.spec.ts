import { WalletCurrency } from "@app/graphql/generated"
import { toWalletMoneyAmount } from "@app/types/amounts"

describe("toWalletMoneyAmount", () => {
  it("creates BTC money amount for BTC currency", () => {
    const result = toWalletMoneyAmount(50000, WalletCurrency.Btc)

    expect(result.amount).toBe(50000)
    expect(result.currency).toBe(WalletCurrency.Btc)
    expect(result.currencyCode).toBe("BTC")
  })

  it("creates USD money amount for USD currency", () => {
    const result = toWalletMoneyAmount(1500, WalletCurrency.Usd)

    expect(result.amount).toBe(1500)
    expect(result.currency).toBe(WalletCurrency.Usd)
    expect(result.currencyCode).toBe("USD")
  })

  it("uses absolute value for negative amounts", () => {
    const result = toWalletMoneyAmount(-1000, WalletCurrency.Btc)

    expect(result.amount).toBe(1000)
  })

  it("handles zero amount", () => {
    const result = toWalletMoneyAmount(0, WalletCurrency.Btc)

    expect(result.amount).toBe(0)
  })
})
