import { WalletCurrency } from "@app/graphql/generated"
import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  noPriceSource,
  RateFreshness,
  SATS_DISPLAY_CURRENCY,
  type PriceSource,
} from "@app/types/price"
import {
  createPriceConverters,
  priceOfCurrencyInCurrencyFromRates,
  satsOnlyPriceOfCurrencyInCurrency,
  selectPrice,
} from "@app/utils/price-conversion"

const mockRecordAppError = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
}))

const priced = { displayCurrencyPerSat: 1.5, displayCurrencyPerCent: 15 }

const source = (
  rates: PriceSource["rates"],
  hasSettled = true,
  freshness: RateFreshness = rates ? RateFreshness.Fresh : RateFreshness.Expired,
): PriceSource => ({ rates, freshness, hasSettled })

describe("selectPrice", () => {
  const selfCustodial = (selfCustodialSource: PriceSource, backendSource: PriceSource) =>
    selectPrice({
      isSelfCustodial: true,
      displayCurrency: "NGN",
      selfCustodialSource,
      backendSource,
    })

  it("prices off the SDK feed ahead of the backend", () => {
    const feed = source(priced)

    const selection = selfCustodial(feed, source({ ...priced }))

    expect(selection.source).toBe(feed)
    expect(selection.shownCurrency).toBe("NGN")
    expect(selection.isSatsOnly).toBe(false)
  })

  it("falls back to the backend when the feed cannot price the currency", () => {
    const backend = source(priced)

    expect(selfCustodial(source(undefined), backend).source).toBe(backend)
  })

  it("waits while a source is still trying", () => {
    const selection = selfCustodial(source(undefined), source(undefined, false))
    expect(selection.isSatsOnly).toBe(false)
    expect(selection.shownCurrency).toBe("NGN")
  })

  it("falls back to sats once every source has finished empty", () => {
    const selection = selfCustodial(source(undefined), source(undefined))

    expect(selection.isSatsOnly).toBe(true)
    expect(selection.shownCurrency).toBe(SATS_DISPLAY_CURRENCY)
  })

  it("leaves sats the moment a source prices the currency again", () => {
    const selection = selfCustodial(source(undefined), source(priced))

    expect(selection.isSatsOnly).toBe(false)
    expect(selection.shownCurrency).toBe("NGN")
  })

  it("keeps a custodial session waiting rather than falling back to sats", () => {
    const selection = selectPrice({
      isSelfCustodial: false,
      displayCurrency: "NGN",
      selfCustodialSource: noPriceSource,
      backendSource: source(undefined),
    })

    expect(selection.isSatsOnly).toBe(false)
    expect(selection.shownCurrency).toBe("NGN")
  })
})

describe("the conversion matrices", () => {
  it("prices sats-only bitcoin legs one for one", () => {
    expect(satsOnlyPriceOfCurrencyInCurrency(WalletCurrency.Btc, DisplayCurrency)).toBe(1)
    expect(satsOnlyPriceOfCurrencyInCurrency(DisplayCurrency, WalletCurrency.Btc)).toBe(1)
  })

  it("leaves sats-only dollar legs unknown", () => {
    expect(satsOnlyPriceOfCurrencyInCurrency(WalletCurrency.Usd, DisplayCurrency)).toBe(
      NaN,
    )
    expect(
      satsOnlyPriceOfCurrencyInCurrency(WalletCurrency.Btc, WalletCurrency.Usd),
    ).toBe(NaN)
  })

  it("derives every leg from the two rates", () => {
    const prices = priceOfCurrencyInCurrencyFromRates(1.5, 15)

    expect(prices?.(WalletCurrency.Btc, DisplayCurrency)).toBe(1.5)
    expect(prices?.(WalletCurrency.Usd, DisplayCurrency)).toBe(15)
    expect(prices?.(WalletCurrency.Btc, WalletCurrency.Usd)).toBe(0.1)
    expect(prices?.(WalletCurrency.Usd, WalletCurrency.Btc)).toBe(10)
  })

  it("has no matrix while either rate is missing", () => {
    expect(priceOfCurrencyInCurrencyFromRates(NaN, 15)).toBeUndefined()
    expect(priceOfCurrencyInCurrencyFromRates(1.5, NaN)).toBeUndefined()
  })
})

describe("createPriceConverters", () => {
  beforeEach(() => {
    mockRecordAppError.mockClear()
  })

  const prices = priceOfCurrencyInCurrencyFromRates(1.5, 15)
  if (!prices) throw new Error("the fixture rates must price")

  it("converts into the shown display currency", () => {
    const { convertMoneyAmount } = createPriceConverters(prices, "NGN")

    expect(convertMoneyAmount(toBtcMoneyAmount(1000), DisplayCurrency)).toEqual({
      amount: 1500,
      currency: DisplayCurrency,
      currencyCode: "NGN",
    })
  })

  it("returns an amount already in the target currency untouched", () => {
    const { convertMoneyAmount } = createPriceConverters(prices, "NGN")
    const sats = toBtcMoneyAmount(1000)

    expect(convertMoneyAmount(sats, WalletCurrency.Btc)).toBe(sats)
  })

  it("rounds with the function it is given", () => {
    const { convertMoneyAmountWithRounding } = createPriceConverters(prices, "NGN")

    expect(
      convertMoneyAmountWithRounding(toUsdMoneyAmount(1), WalletCurrency.Btc, Math.ceil)
        .amount,
    ).toBe(10)
    expect(
      convertMoneyAmountWithRounding(toBtcMoneyAmount(3), WalletCurrency.Usd, Math.floor)
        .amount,
    ).toBe(0)
  })

  it("refuses a display amount tagged with another display currency, and reports it", () => {
    const { convertMoneyAmount } = createPriceConverters(prices, "NGN")

    const converted = convertMoneyAmount(
      { amount: 1000, currency: DisplayCurrency, currencyCode: SATS_DISPLAY_CURRENCY },
      WalletCurrency.Btc,
    )

    expect(converted.amount).toBeNaN()
    expect(mockRecordAppError).toHaveBeenCalledTimes(1)
  })
})
