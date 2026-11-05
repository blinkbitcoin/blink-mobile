import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useHistoryWalletSummary } from "@app/screens/transaction-history/use-history-wallet-summary"

const mockUseSendWallets = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/hooks/use-send-wallets", () => ({
  useSendWallets: () => mockUseSendWallets(),
}))

/** 1 cent buys 10 sats; a display conversion keeps the amount and swaps the currency. */
const mockConvertMoneyAmount = jest.fn(
  (amount: { amount: number; currency: string }, toCurrency: string) => ({
    amount:
      amount.currency === "USD" && toCurrency === "BTC"
        ? amount.amount * 10
        : amount.amount,
    currency: toCurrency,
    currencyCode: toCurrency,
  }),
)
let mockHasConversion = true
jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockHasConversion ? mockConvertMoneyAmount : undefined,
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({
      moneyAmount,
      isApproximate,
    }: {
      moneyAmount: { amount: number; currency: string }
      isApproximate?: boolean
    }) => `${isApproximate ? "~" : ""}${moneyAmount.amount} ${moneyAmount.currency}`,
    getSecondaryAmountIfCurrencyIsDifferent: ({
      displayAmount,
    }: {
      displayAmount: { amount: number; currency: string }
    }) => displayAmount,
  }),
}))

const btcWallet = { id: "btc", walletCurrency: WalletCurrency.Btc, balance: 1000 }
const usdWallet = { id: "usd", walletCurrency: WalletCurrency.Usd, balance: 50 }

const summaryFor = (selected: Parameters<typeof useHistoryWalletSummary>[0]) =>
  renderHook(() => useHistoryWalletSummary(selected)).result.current

beforeEach(() => {
  mockHasConversion = true
  mockUseSendWallets.mockReturnValue({ btcWallet, usdWallet, loading: false })
})

describe("useHistoryWalletSummary", () => {
  describe("with both wallets", () => {
    it("shows the wallet that was asked for", () => {
      expect(summaryFor("ALL").wallet).toBe("ALL")
      expect(summaryFor(WalletCurrency.Btc).wallet).toBe(WalletCurrency.Btc)
      expect(summaryFor(WalletCurrency.Usd).wallet).toBe(WalletCurrency.Usd)
    })

    it("cycles All → Bitcoin → Dollar → All", () => {
      expect(summaryFor("ALL").nextWallet).toBe(WalletCurrency.Btc)
      expect(summaryFor(WalletCurrency.Btc).nextWallet).toBe(WalletCurrency.Usd)
      expect(summaryFor(WalletCurrency.Usd).nextWallet).toBe("ALL")
    })

    it("leads All with the bitcoin balance plus the dollar balance in sats", () => {
      // 1,000 sats + 50 cents × 10 sats a cent
      expect(summaryFor("ALL").balancePrimary).toBe("1500 BTC")
    })

    it("shows each single wallet's own balance", () => {
      expect(summaryFor(WalletCurrency.Btc).balancePrimary).toBe("1000 BTC")
      expect(summaryFor(WalletCurrency.Usd).balancePrimary).toBe("50 USD")
    })

    it("puts the approximate display amount under it", () => {
      expect(summaryFor("ALL").balanceSecondary).toBe("~1500 DisplayCurrency")
    })
  })

  describe("with no dollar wallet", () => {
    beforeEach(() => {
      mockUseSendWallets.mockReturnValue({
        btcWallet,
        usdWallet: undefined,
        loading: false,
      })
    })

    it("shows Bitcoin whatever was asked for", () => {
      expect(summaryFor("ALL").wallet).toBe(WalletCurrency.Btc)
      expect(summaryFor(WalletCurrency.Usd).wallet).toBe(WalletCurrency.Btc)
    })

    it("has nothing to cycle to", () => {
      expect(summaryFor("ALL").nextWallet).toBeUndefined()
    })
  })

  it("keeps the wallet that was asked for while the wallets load", () => {
    mockUseSendWallets.mockReturnValue({ btcWallet, usdWallet: undefined, loading: true })

    expect(summaryFor("ALL").wallet).toBe("ALL")
    expect(summaryFor("ALL").nextWallet).toBe(WalletCurrency.Btc)
  })

  describe("while a balance it needs is missing", () => {
    it("flags All as loading instead of rendering an empty amount", () => {
      mockUseSendWallets.mockReturnValue({
        btcWallet,
        usdWallet: undefined,
        loading: true,
      })

      const summary = summaryFor("ALL")

      expect(summary.balanceLoading).toBe(true)
      expect(summary.balancePrimary).toBe("")
      expect(summary.balanceSecondary).toBeUndefined()
    })

    it("flags All as loading when the bitcoin wallet is missing", () => {
      mockUseSendWallets.mockReturnValue({
        btcWallet: undefined,
        usdWallet,
        loading: true,
      })

      expect(summaryFor("ALL").balanceLoading).toBe(true)
    })

    it("still shows Bitcoin, which doesn't need the dollar balance", () => {
      mockUseSendWallets.mockReturnValue({
        btcWallet,
        usdWallet: undefined,
        loading: true,
      })

      const summary = summaryFor(WalletCurrency.Btc)

      expect(summary.balanceLoading).toBe(false)
      expect(summary.balancePrimary).toBe("1000 BTC")
    })

    it("is not loading once both balances are in", () => {
      expect(summaryFor("ALL").balanceLoading).toBe(false)
    })
  })

  it("falls back to the bitcoin balance alone when prices are not loaded", () => {
    mockHasConversion = false

    const summary = summaryFor("ALL")

    expect(summary.balancePrimary).toBe("1000 BTC")
    expect(summary.balanceSecondary).toBeUndefined()
  })
})
