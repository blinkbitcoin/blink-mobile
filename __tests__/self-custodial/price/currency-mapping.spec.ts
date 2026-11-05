import { describe, expect, it } from "@jest/globals"

import { type FiatCurrency } from "@breeztech/breez-sdk-spark-react-native"

import {
  flagForCurrencyCode,
  toDisplayCurrencyEntry,
  toDisplayCurrencyList,
} from "@app/self-custodial/price/currency-mapping"

const currency = (id: string, info: Partial<FiatCurrency["info"]> = {}): FiatCurrency =>
  ({
    id,
    info: {
      name: `${id} name`,
      fractionSize: 2,
      spacing: undefined,
      symbol: undefined,
      uniqSymbol: undefined,
      localizedName: [],
      localeOverrides: [],
      ...info,
    },
  }) as FiatCurrency

const grapheme = (value: string) => ({
  grapheme: value,
  template: undefined,
  rtl: undefined,
  position: undefined,
})

describe("flagForCurrencyCode", () => {
  // The expectations come from the backend's own currencyList, which is the list this
  // one has to be indistinguishable from.
  it.each([
    ["USD", "🇺🇸"],
    ["EUR", "🇪🇺"],
    ["PKR", "🇵🇰"],
    ["COP", "🇨🇴"],
    ["NGN", "🇳🇬"],
  ])("derives %s as %s", (code, flag) => {
    expect(flagForCurrencyCode(code)).toBe(flag)
  })

  it("is case-insensitive", () => {
    expect(flagForCurrencyCode("ngn")).toBe("🇳🇬")
  })

  it.each(["XAF", "XOF", "XCD", "XPF", "XDR", "XAU", "XTS"])(
    "gives %s no flag rather than a wrong one",
    (code) => {
      // X is not a country. A flag here would be a fabrication, and the row reads
      // correctly without one.
      expect(flagForCurrencyCode(code)).toBe("")
    },
  )

  it("gives nothing for a code that is not two letters", () => {
    expect(flagForCurrencyCode("")).toBe("")
    expect(flagForCurrencyCode("U")).toBe("")
    expect(flagForCurrencyCode("1SD")).toBe("")
  })
})

describe("toDisplayCurrencyEntry", () => {
  it("maps the fields the app renders", () => {
    const entry = toDisplayCurrencyEntry(
      currency("NGN", { name: "Nigerian Naira", fractionSize: 2, symbol: grapheme("₦") }),
    )

    expect(entry).toEqual({
      id: "NGN",
      flag: "🇳🇬",
      name: "Nigerian Naira",
      symbol: "₦",
      fractionDigits: 2,
    })
  })

  it("falls back to the unique symbol, then to the code itself", () => {
    expect(
      toDisplayCurrencyEntry(currency("AUD", { uniqSymbol: grapheme("A$") }))?.symbol,
    ).toBe("A$")
    expect(toDisplayCurrencyEntry(currency("XYZ"))?.symbol).toBe("XYZ")
  })

  it("carries a zero fraction size, which whole-unit currencies have", () => {
    expect(
      toDisplayCurrencyEntry(currency("JPY", { fractionSize: 0 }))?.fractionDigits,
    ).toBe(0)
  })

  it("uppercases the code so it matches a stored preference", () => {
    expect(toDisplayCurrencyEntry(currency("ngn"))?.id).toBe("NGN")
  })

  it("drops an entry with no name rather than showing a blank row", () => {
    expect(toDisplayCurrencyEntry(currency("AAA", { name: "" }))).toBeUndefined()
  })

  it("drops an entry whose fraction size is not a whole count", () => {
    // Formatting against it would round to a nonsense number of places.
    expect(toDisplayCurrencyEntry(currency("AAA", { fractionSize: -1 }))).toBeUndefined()
    expect(toDisplayCurrencyEntry(currency("AAA", { fractionSize: 1.5 }))).toBeUndefined()
  })
})

describe("toDisplayCurrencyList", () => {
  it("sorts by name, the order the picker already shows", () => {
    const list = toDisplayCurrencyList([
      currency("USD", { name: "US Dollar" }),
      currency("EUR", { name: "Euro" }),
      currency("NGN", { name: "Nigerian Naira" }),
    ])

    expect(list.map((entry) => entry.id)).toEqual(["EUR", "NGN", "USD"])
  })

  it("leaves out the entries it cannot map", () => {
    const list = toDisplayCurrencyList([
      currency("USD", { name: "US Dollar" }),
      currency("AAA", { name: "" }),
    ])

    expect(list.map((entry) => entry.id)).toEqual(["USD"])
  })

  it("maps an empty feed to an empty list", () => {
    expect(toDisplayCurrencyList([])).toEqual([])
  })
})
