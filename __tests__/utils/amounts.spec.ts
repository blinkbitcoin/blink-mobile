import { WalletCurrency } from "@app/graphql/generated"
import {
  centsToTokenBaseUnits,
  toSatsAmount,
  tokenBaseUnitsToCents,
  tokenBaseUnitsToCentsCeil,
  tokenBaseUnitsToCentsExact,
} from "@app/utils/amounts"

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

describe("tokenBaseUnitsToCentsExact", () => {
  it("preserves sub-cent precision when token decimals exceed display decimals", () => {
    // 1.000001 USDB (6 decimals) = 1.0000001 cents (lossless)
    expect(tokenBaseUnitsToCentsExact(1_000_001, 6)).toBe(100.0001)
    expect(tokenBaseUnitsToCentsExact(1_500_000, 6)).toBe(150)
  })

  it("returns the raw amount when token decimals match display decimals", () => {
    expect(tokenBaseUnitsToCentsExact(150, 2)).toBe(150)
  })

  it("returns the raw amount when token has fewer decimals than display", () => {
    expect(tokenBaseUnitsToCentsExact(150, 1)).toBe(150)
  })
})

describe("tokenBaseUnitsToCents (round)", () => {
  it("rounds to the nearest cent", () => {
    expect(tokenBaseUnitsToCents(1_499_999, 6)).toBe(150)
    expect(tokenBaseUnitsToCents(1_500_001, 6)).toBe(150)
  })

  it("rounds 0.5 ¢ residue up to the next cent (banker's rounding off)", () => {
    expect(tokenBaseUnitsToCents(1_005_000, 6)).toBe(101)
  })
})

describe("tokenBaseUnitsToCentsCeil — for SDK minimums", () => {
  it("rounds up when there is any sub-cent residue", () => {
    expect(tokenBaseUnitsToCentsCeil(1_000_001, 6)).toBe(101)
  })

  it("does not change values that are already on a whole-cent boundary", () => {
    expect(tokenBaseUnitsToCentsCeil(1_500_000, 6)).toBe(150)
  })

  it("rounds up tiny fractional residues to 1 cent", () => {
    expect(tokenBaseUnitsToCentsCeil(1, 6)).toBe(1)
  })
})

describe("centsToTokenBaseUnits", () => {
  it("scales cents into token base units when token has more decimals", () => {
    expect(centsToTokenBaseUnits(150, 6)).toBe(1_500_000)
  })

  it("returns the input untouched when decimals match display", () => {
    expect(centsToTokenBaseUnits(150, 2)).toBe(150)
  })

  it("rounds the scaled product so non-integer cents survive without drift", () => {
    expect(centsToTokenBaseUnits(0.5, 6)).toBe(5000)
  })
})

describe("token base-unit round-trip", () => {
  it("survives cents -> base units -> cents", () => {
    const cents = 137
    const tokenDecimals = 6
    const baseUnits = centsToTokenBaseUnits(cents, tokenDecimals)
    expect(tokenBaseUnitsToCents(baseUnits, tokenDecimals)).toBe(cents)
  })
})
