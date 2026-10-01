import { describe, expect, it } from "@jest/globals"

import { withPreferredNames, type DisplayCurrencyEntry } from "@app/types/currency"

/** Breez's bundled list carries the raw ISO 4217 name column, which is inconsistent:
 *  "US Dollar" is qualified, "Naira" is not. */
const fromSdk: DisplayCurrencyEntry[] = [
  { id: "NGN", flag: "🇳🇬", name: "Naira", symbol: "₦", fractionDigits: 2 },
  { id: "USD", flag: "🇺🇸", name: "US Dollar", symbol: "$", fractionDigits: 2 },
]

/** The backend's names are uniformly country-qualified, which is what the picker has
 *  always shown. */
const fromBackend: DisplayCurrencyEntry[] = [
  { id: "NGN", flag: "🇳🇬", name: "Nigerian Naira", symbol: "₦", fractionDigits: 2 },
  { id: "USD", flag: "🇺🇸", name: "US Dollar", symbol: "$", fractionDigits: 2 },
  { id: "XTS", flag: "🧪", name: "Test Currency", symbol: "¤", fractionDigits: 0 },
]

describe("withPreferredNames", () => {
  it("takes the backend's wording for a currency Breez names bare", () => {
    const merged = withPreferredNames(fromSdk, fromBackend)

    expect(merged.find((c) => c.id === "NGN")?.name).toBe("Nigerian Naira")
  })

  it("keeps the fraction size from the list that prices the amount", () => {
    // Not a label: it is the input the rate was scaled by, and taking it from a
    // different source than the rate would be a way to misprice.
    const disagreeing = [{ ...fromBackend[0], fractionDigits: 0 }]

    expect(withPreferredNames(fromSdk, disagreeing)[0].fractionDigits).toBe(2)
  })

  it("does not add currencies the base list does not carry", () => {
    // The base is what can still be priced offline; the overlay only renames.
    expect(withPreferredNames(fromSdk, fromBackend).map((c) => c.id)).toEqual([
      "NGN",
      "USD",
    ])
  })

  it("leaves a currency the backend does not name alone", () => {
    const partial = [fromBackend[1]]

    expect(withPreferredNames(fromSdk, partial).find((c) => c.id === "NGN")?.name).toBe(
      "Naira",
    )
  })

  it("matches codes regardless of casing", () => {
    const lowercased = [{ ...fromBackend[0], id: "ngn" }]

    expect(withPreferredNames(fromSdk, lowercased)[0].name).toBe("Nigerian Naira")
  })

  it("returns the base unchanged when the backend has nothing to say", () => {
    // Offline: Breez's wording stands, and a memoised consumer must not re-render.
    expect(withPreferredNames(fromSdk, [])).toBe(fromSdk)
  })

  it("returns the base unchanged when both agree", () => {
    expect(withPreferredNames(fromSdk, fromSdk)).toBe(fromSdk)
  })

  it("handles an empty base", () => {
    expect(withPreferredNames([], fromBackend)).toEqual([])
  })
})
