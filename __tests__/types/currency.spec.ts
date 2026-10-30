import { describe, expect, it } from "@jest/globals"

import { mergeCurrencyLists, type DisplayCurrencyEntry } from "@app/types/currency"

/** Breez's bundled list carries the raw ISO 4217 name column, which is inconsistent:
 *  "US Dollar" is qualified, "Naira" is not. */
const fromSdk: DisplayCurrencyEntry[] = [
  { id: "NGN", flag: "🇳🇬", name: "Naira", symbol: "₦", fractionDigits: 2 },
  { id: "USD", flag: "🇺🇸", name: "US Dollar", symbol: "$", fractionDigits: 2 },
  { id: "CNY", flag: "🇨🇳", name: "Yuan Renminbi", symbol: "¥", fractionDigits: 2 },
]

/** The backend's names are uniformly country-qualified, which is what the picker has
 *  always shown. */
const fromBackend: DisplayCurrencyEntry[] = [
  { id: "NGN", flag: "🇳🇬", name: "Nigerian Naira", symbol: "₦", fractionDigits: 2 },
  { id: "USD", flag: "🇺🇸", name: "US Dollar", symbol: "$", fractionDigits: 2 },
  { id: "GHS", flag: "🇬🇭", name: "Ghanaian Cedi", symbol: "₵", fractionDigits: 2 },
]

const byId = (list: readonly DisplayCurrencyEntry[], id: string) =>
  list.find((entry) => entry.id === id)

describe("mergeCurrencyLists", () => {
  it("takes the earlier list's wording for a code both carry", () => {
    const merged = mergeCurrencyLists(fromBackend, fromSdk)

    expect(byId(merged, "NGN")?.name).toBe("Nigerian Naira")
  })

  it("takes the earlier list's fraction size too", () => {
    // The backend's rate is already in its own minor units, so only its size is right
    // for it; the feed's whole-unit rate scales to either. COP is one they disagree on.
    const sdkCop = [{ ...fromSdk[0], id: "COP", fractionDigits: 0 }]
    const backendCop = [{ ...fromBackend[0], id: "COP", fractionDigits: 2 }]

    expect(byId(mergeCurrencyLists(backendCop, sdkCop), "COP")?.fractionDigits).toBe(2)
  })

  it("carries the codes only one list has", () => {
    // GHS is priced by the backend alone; CNY only by the feed. Neither may vanish.
    const merged = mergeCurrencyLists(fromBackend, fromSdk)

    expect(merged.map((entry) => entry.id)).toEqual(["NGN", "USD", "GHS", "CNY"])
  })

  it("matches codes regardless of casing", () => {
    const lowercased = [{ ...fromBackend[0], id: "ngn" }]

    const merged = mergeCurrencyLists(lowercased, fromSdk)

    expect(merged.map((entry) => entry.id)).toEqual(["ngn", "USD", "CNY"])
  })

  it("returns the earlier list itself when the later adds nothing", () => {
    // A memoised consumer must not re-render for a merge that changed nothing.
    const subset = [fromSdk[0]]

    expect(mergeCurrencyLists(fromBackend, subset)).toBe(fromBackend)
    expect(mergeCurrencyLists(fromBackend, [])).toBe(fromBackend)
  })

  it("returns the later list itself while the earlier is empty", () => {
    // Offline: the feed is all there is, and it must stay the same array.
    expect(mergeCurrencyLists([], fromSdk)).toBe(fromSdk)
  })

  it("returns the same empty list when every list is empty", () => {
    expect(mergeCurrencyLists([], [])).toEqual([])
    expect(mergeCurrencyLists([], [])).toBe(mergeCurrencyLists())
  })

  it("takes a code from the first list that carries it", () => {
    const third = [{ ...fromSdk[2], name: "Chinese Yuan" }]

    expect(byId(mergeCurrencyLists(fromBackend, fromSdk, third), "CNY")?.name).toBe(
      "Yuan Renminbi",
    )
  })
})
