import { formatBalance } from "@app/screens/settings-screen/self-custodial/format-balance"
import { WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"

const formatMoneyAmount = ({
  moneyAmount,
}: {
  moneyAmount: { amount: number; currency: string }
}) => {
  if (moneyAmount.currency === WalletCurrency.Btc) return `${moneyAmount.amount} SAT`
  return `$${(moneyAmount.amount / 100).toFixed(2)}`
}

describe("formatBalance", () => {
  it("returns an empty string when no wallet has a positive balance", () => {
    const result = formatBalance(
      [{ balance: toBtcMoneyAmount(0) }, { balance: toUsdMoneyAmount(0) }],
      formatMoneyAmount,
    )

    expect(result).toBe("")
  })

  it("returns the formatted amount for a single non-zero wallet", () => {
    const result = formatBalance([{ balance: toBtcMoneyAmount(522) }], formatMoneyAmount)

    expect(result).toBe("522 SAT")
  })

  it("joins multiple non-zero balances with ' + '", () => {
    const result = formatBalance(
      [{ balance: toBtcMoneyAmount(522) }, { balance: toUsdMoneyAmount(987) }],
      formatMoneyAmount,
    )

    expect(result).toBe("522 SAT + $9.87")
  })

  it("filters out wallets with zero balance and keeps the rest", () => {
    const result = formatBalance(
      [{ balance: toBtcMoneyAmount(0) }, { balance: toUsdMoneyAmount(450) }],
      formatMoneyAmount,
    )

    expect(result).toBe("$4.50")
  })

  it("handles an empty wallet array", () => {
    expect(formatBalance([], formatMoneyAmount)).toBe("")
  })

  it("preserves the order of the input wallets when joining", () => {
    const result = formatBalance(
      [{ balance: toUsdMoneyAmount(987) }, { balance: toBtcMoneyAmount(522) }],
      formatMoneyAmount,
    )

    expect(result).toBe("$9.87 + 522 SAT")
  })
})
