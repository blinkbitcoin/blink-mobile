import { WalletCurrency } from "@app/graphql/generated"
import { hasFunds, isFunded } from "@app/utils/has-funds"

const walletWith = (amount: number) => ({
  balance: { amount, currency: WalletCurrency.Btc, currencyCode: "BTC" as const },
})

describe("isFunded", () => {
  it("returns true for a positive balance", () => {
    expect(isFunded(walletWith(1))).toBe(true)
  })

  it("returns false for zero balance", () => {
    expect(isFunded(walletWith(0))).toBe(false)
  })

  it("returns false for negative balance (defensive)", () => {
    expect(isFunded(walletWith(-1))).toBe(false)
  })
})

describe("hasFunds", () => {
  it("returns false for an empty list", () => {
    expect(hasFunds([])).toBe(false)
  })

  it("returns false when every wallet has zero balance", () => {
    expect(hasFunds([walletWith(0), walletWith(0)])).toBe(false)
  })

  it("returns true when at least one wallet has positive balance", () => {
    expect(hasFunds([walletWith(0), walletWith(100)])).toBe(true)
  })

  it("returns false for negative balances (defensive)", () => {
    expect(hasFunds([walletWith(-1)])).toBe(false)
  })
})
