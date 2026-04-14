import { WalletCurrency } from "@app/graphql/generated"
import { toSatsAmount } from "@app/types/amounts"

const mockConvert = jest.fn()

describe("toSatsAmount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns sats directly when amount is already BTC", () => {
    const btcAmount = { amount: 5000, currency: WalletCurrency.Btc, currencyCode: "BTC" }
    mockConvert.mockReturnValue(btcAmount)

    const result = toSatsAmount(btcAmount, mockConvert)

    expect(result).toBe(5000)
    expect(mockConvert).toHaveBeenCalledWith(btcAmount, WalletCurrency.Btc)
  })

  it("converts USD amount to sats", () => {
    const usdAmount = { amount: 500, currency: WalletCurrency.Usd, currencyCode: "USD" }
    mockConvert.mockReturnValue({
      amount: 6678,
      currency: WalletCurrency.Btc,
      currencyCode: "BTC",
    })

    const result = toSatsAmount(usdAmount, mockConvert)

    expect(result).toBe(6678)
    expect(mockConvert).toHaveBeenCalledWith(usdAmount, WalletCurrency.Btc)
  })
})
