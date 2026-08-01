/**
 * The @wdio/mocha-framework types in tsconfig.jest.json shadow jest's, and
 * mocha's `describe` has no `.each`; same import the screen specs use.
 */
import { describe } from "@jest/globals"

import { WalletCurrency } from "@app/graphql/generated"
import { CurrencyInfo } from "@app/hooks/use-display-currency"
import { WalletOrDisplayCurrency } from "@app/types/amounts"
import {
  parseStringToNumberPad,
  numberPadToString,
  formatNumberPadNumber,
  NumberPadNumber,
} from "@app/components/amount-input-screen/number-pad-reducer"
import { groupedInLocale, withDeviceLocale } from "../helpers/device-locale"

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
  /**
   * The literals below are how en-US groups digits. formatNumberPadNumber
   * deliberately follows the device locale, so the locale has to be stated for
   * them to mean anything; otherwise they assert whatever locale the machine
   * running the suite is set to. The block after this one covers the others.
   */
  withDeviceLocale("en-US")

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

/**
 * The amount being typed is grouped the way the user's own device groups
 * digits — that is what the bare `toLocaleString()` in formatNumberPadNumber is
 * for. These run the same code as if the device were set to each locale in
 * turn; converted amounts elsewhere in the app stay pinned to "en-US" (see
 * formatCurrencyHelper in @app/hooks/use-display-currency).
 */
describe("formatNumberPadNumber follows the device locale", () => {
  const formatBtc = (majorAmount: string, minorAmount = "") =>
    formatNumberPadNumber({
      numberPadNumber: { majorAmount, minorAmount, hasDecimal: Boolean(minorAmount) },
      currency: WalletCurrency.Btc,
      currencyInfo,
    })

  /**
   * Locales that group with a plain "," or "." are stable enough across CLDR
   * releases to spell out, which keeps a real oracle in the suite rather than
   * one derived from the same ICU data as the code. hi-IN groups in lakhs, so
   * it also catches swapping the separator while keeping en-US's pattern.
   */
  const STABLE_GROUPING = [
    { deviceLocale: "en-US", hundredThousand: "100,000", million: "1,000,000" },
    { deviceLocale: "de-DE", hundredThousand: "100.000", million: "1.000.000" },
    { deviceLocale: "hi-IN", hundredThousand: "1,00,000", million: "10,00,000" },
  ]

  describe.each(STABLE_GROUPING)(
    "on a device set to $deviceLocale",
    ({ deviceLocale, hundredThousand, million }) => {
      withDeviceLocale(deviceLocale)

      it("groups the major amount the way the device does", () => {
        expect(formatBtc("100000")).toBe(`${hundredThousand} SAT`)
        expect(formatBtc("1000000")).toBe(`${million} SAT`)
      })

      it("leaves the decimal separator as the '.' the keypad types", () => {
        /**
         * Only grouping is localised: the minor amount is appended verbatim
         * after a literal ".", because "." is the key the number pad offers.
         * In de-DE that reads as "100.000.5", the group and decimal separators
         * being the same character.
         */
        expect(formatBtc("100000", "5")).toBe(`${hundredThousand}.5 SAT`)
      })
    },
  )

  /**
   * Which space these group with is CLDR-version dependent (fr-FR moved from
   * U+00A0 to U+202F in CLDR 34, and en-ZA is still on U+00A0), so the
   * separator is read from the same ICU data rather than hardcoded. The
   * assertion is that the number pad followed the device, not which byte that
   * locale uses this year; the en-US check below is what makes that bite.
   */
  describe.each(["fr-FR", "en-ZA"])("on a device set to %s", (deviceLocale) => {
    withDeviceLocale(deviceLocale)

    it("groups the major amount the way the device does", () => {
      expect(formatBtc("100000")).toBe(`${groupedInLocale(100000, deviceLocale)} SAT`)
    })

    it("does not fall back to en-US grouping", () => {
      expect(formatBtc("100000")).not.toBe("100,000 SAT")
    })
  })
})
