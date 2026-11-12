import { it } from "@jest/globals"

import { WalletCurrency } from "@app/graphql/generated"
import { CurrencyInfo } from "@app/hooks/use-display-currency"
import { DisplayCurrency, WalletOrDisplayCurrency } from "@app/types/amounts"
import {
  moneyAmountToNumberPadReducerState,
  numberPadNumberToMoneyAmount,
} from "@app/components/amount-input-screen/number-pad-amount"

const currencyInfo: Record<WalletOrDisplayCurrency, CurrencyInfo> = {
  BTC: {
    symbol: "",
    minorUnitToMajorUnitOffset: 0,
    showFractionDigits: false,
    currencyCode: "SAT",
  },
  USD: {
    symbol: "$",
    minorUnitToMajorUnitOffset: 2,
    showFractionDigits: true,
    currencyCode: "USD",
  },
  /** A display currency with no minor unit shown, like JPY. */
  DisplayCurrency: {
    symbol: "¥",
    minorUnitToMajorUnitOffset: 2,
    showFractionDigits: false,
    currencyCode: "JPY",
  },
}

const toMoney = (
  majorAmount: string,
  minorAmount: string,
  currency: WalletOrDisplayCurrency,
) =>
  numberPadNumberToMoneyAmount({
    numberPadNumber: { majorAmount, minorAmount, hasDecimal: minorAmount !== "" },
    currency,
    currencyInfo,
  })

const toState = (amount: number, currency: WalletOrDisplayCurrency) =>
  moneyAmountToNumberPadReducerState({
    moneyAmount: { amount, currency, currencyCode: currencyInfo[currency].currencyCode },
    currencyInfo,
  })

describe("numberPadNumberToMoneyAmount", () => {
  it("reads sats as whole units", () => {
    expect(toMoney("2100", "", WalletCurrency.Btc)).toEqual({
      amount: 2100,
      currency: WalletCurrency.Btc,
      currencyCode: "SAT",
    })
  })

  it("reads dollars and cents into cents", () => {
    expect(toMoney("12", "34", WalletCurrency.Usd).amount).toBe(1234)
  })

  it("pads a single typed cent digit to tens of cents", () => {
    expect(toMoney("1", "5", WalletCurrency.Usd).amount).toBe(150)
  })

  it("reads an empty pad as zero", () => {
    expect(toMoney("", "", WalletCurrency.Usd).amount).toBe(0)
  })

  it("reads a leading decimal with no major part", () => {
    expect(toMoney("", "07", WalletCurrency.Usd).amount).toBe(7)
  })

  it("keeps the currency code of the currency asked for", () => {
    expect(toMoney("500", "", DisplayCurrency).currencyCode).toBe("JPY")
  })
})

describe("moneyAmountToNumberPadReducerState", () => {
  it("opens an empty pad on zero, with no decimal", () => {
    expect(toState(0, WalletCurrency.Usd).numberPadNumber).toEqual({
      majorAmount: "",
      minorAmount: "",
      hasDecimal: false,
    })
  })

  it("splits cents into dollars and cents", () => {
    expect(toState(1234, WalletCurrency.Usd)).toEqual({
      numberPadNumber: { majorAmount: "12", minorAmount: "34", hasDecimal: true },
      numberOfDecimalsAllowed: 2,
      currency: WalletCurrency.Usd,
    })
  })

  it("puts a zero before an amount under one dollar and pads its cents", () => {
    expect(toState(5, WalletCurrency.Usd).numberPadNumber).toEqual({
      majorAmount: "0",
      minorAmount: "05",
      hasDecimal: true,
    })
  })

  it("shows sats whole, allowing no decimals", () => {
    expect(toState(2100, WalletCurrency.Btc)).toEqual({
      numberPadNumber: { majorAmount: "2100", minorAmount: "", hasDecimal: false },
      numberOfDecimalsAllowed: 0,
      currency: WalletCurrency.Btc,
    })
  })

  it("drops the minor unit of a currency that does not show it", () => {
    expect(toState(1234, DisplayCurrency)).toEqual({
      numberPadNumber: { majorAmount: "12", minorAmount: "", hasDecimal: false },
      numberOfDecimalsAllowed: 0,
      currency: DisplayCurrency,
    })
  })

  it("shows no decimal under one unit of a currency that does not show it", () => {
    expect(toState(5, DisplayCurrency).numberPadNumber).toEqual({
      majorAmount: "0",
      minorAmount: "",
      hasDecimal: false,
    })
  })

  it.each([0, 5, 150, 1234, 99999])("round-trips %i cents through the pad", (cents) => {
    const { numberPadNumber } = toState(cents, WalletCurrency.Usd)

    expect(
      numberPadNumberToMoneyAmount({
        numberPadNumber,
        currency: WalletCurrency.Usd,
        currencyInfo,
      }).amount,
    ).toBe(cents)
  })
})
