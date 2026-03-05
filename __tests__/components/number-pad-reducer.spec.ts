import { WalletCurrency } from "@app/graphql/generated"
import { CurrencyInfo } from "@app/hooks/use-display-currency"
import { WalletOrDisplayCurrency } from "@app/types/amounts"
import {
  parseStringToNumberPad,
  numberPadToString,
  formatNumberPadNumber,
  NumberPadNumber,
} from "@app/components/amount-input-screen/number-pad-reducer"

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
  DisplayCurrency: {
    symbol: "$",
    minorUnitToMajorUnitOffset: 2,
    showFractionDigits: true,
    currencyCode: "USD",
  },
}

const emptyNumber: NumberPadNumber = {
  majorAmount: "",
  minorAmount: "",
  hasDecimal: false,
}

describe("parseStringToNumberPad", () => {
  it("parses integer string", () => {
    const result = parseStringToNumberPad("1000")
    expect(result).toEqual({
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: false,
    })
  })

  it("parses decimal string", () => {
    const result = parseStringToNumberPad("1000.50")
    expect(result).toEqual({
      majorAmount: "1000",
      minorAmount: "50",
      hasDecimal: true,
    })
  })

  it("parses string with trailing decimal", () => {
    const result = parseStringToNumberPad("1000.")
    expect(result).toEqual({
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: true,
    })
  })

  it("parses empty string", () => {
    const result = parseStringToNumberPad("")
    expect(result).toEqual({
      majorAmount: "",
      minorAmount: "",
      hasDecimal: false,
    })
  })

  it("parses zero", () => {
    const result = parseStringToNumberPad("0")
    expect(result).toEqual({
      majorAmount: "0",
      minorAmount: "",
      hasDecimal: false,
    })
  })

  it("parses decimal less than 1", () => {
    const result = parseStringToNumberPad("0.99")
    expect(result).toEqual({
      majorAmount: "0",
      minorAmount: "99",
      hasDecimal: true,
    })
  })
})

describe("numberPadToString", () => {
  it("converts integer numberPad to string", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: false,
    }
    expect(numberPadToString(numberPad)).toBe("1000")
  })

  it("converts decimal numberPad to string", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "50",
      hasDecimal: true,
    }
    expect(numberPadToString(numberPad)).toBe("1000.50")
  })

  it("converts numberPad with trailing decimal to string", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: true,
    }
    expect(numberPadToString(numberPad)).toBe("1000.")
  })

  it("converts empty numberPad to zero", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "",
      minorAmount: "",
      hasDecimal: false,
    }
    expect(numberPadToString(numberPad)).toBe("0")
  })

  it("converts decimal with empty major to string with zero", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "",
      minorAmount: "50",
      hasDecimal: true,
    }
    expect(numberPadToString(numberPad)).toBe("0.50")
  })
})

describe("formatNumberPadNumber", () => {
  it("returns empty string for empty amounts with non-BTC currency", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: emptyNumber,
        currency: "DisplayCurrency",
        currencyInfo,
      }),
    ).toBe("")
  })

  it("returns '0 SAT' for empty amounts with BTC (noSuffix=false)", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: emptyNumber,
        currency: WalletCurrency.Btc,
        currencyInfo,
      }),
    ).toBe("0 SAT")
  })

  it("returns empty string for empty amounts with BTC (noSuffix=true)", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: emptyNumber,
        currency: WalletCurrency.Btc,
        currencyInfo,
        noSuffix: true,
      }),
    ).toBe("")
  })

  it("formats BTC integer with suffix", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "1500", minorAmount: "", hasDecimal: false },
        currency: WalletCurrency.Btc,
        currencyInfo,
      }),
    ).toBe("1,500 SAT")
  })

  it("formats BTC integer without suffix when noSuffix=true", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "1500", minorAmount: "", hasDecimal: false },
        currency: WalletCurrency.Btc,
        currencyInfo,
        noSuffix: true,
      }),
    ).toBe("1,500")
  })

  it("formats USD integer without decimal", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "42", minorAmount: "", hasDecimal: false },
        currency: WalletCurrency.Usd,
        currencyInfo,
      }),
    ).toBe("42")
  })

  it("formats USD with decimal places", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "42", minorAmount: "99", hasDecimal: true },
        currency: WalletCurrency.Usd,
        currencyInfo,
      }),
    ).toBe("42.99")
  })

  it("formats USD with trailing decimal", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "42", minorAmount: "", hasDecimal: true },
        currency: WalletCurrency.Usd,
        currencyInfo,
      }),
    ).toBe("42.")
  })

  it("formats zero major with decimal", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "0", minorAmount: "5", hasDecimal: true },
        currency: WalletCurrency.Usd,
        currencyInfo,
      }),
    ).toBe("0.5")
  })

  it("formats BTC with decimal and suffix", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "10", minorAmount: "5", hasDecimal: true },
        currency: WalletCurrency.Btc,
        currencyInfo,
      }),
    ).toBe("10.5 SAT")
  })

  it("formats large number with commas", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "1000000", minorAmount: "", hasDecimal: false },
        currency: WalletCurrency.Usd,
        currencyInfo,
      }),
    ).toBe("1,000,000")
  })

  it("formats DisplayCurrency amounts", () => {
    expect(
      formatNumberPadNumber({
        numberPadNumber: { majorAmount: "25", minorAmount: "50", hasDecimal: true },
        currency: "DisplayCurrency",
        currencyInfo,
      }),
    ).toBe("25.50")
  })
})
