import { BTCMAP_FALLBACK_ICON, materialIconName } from "@app/btcmap/icons"

describe("materialIconName", () => {
  it("reshapes BTC Map's snake_case names into the font's kebab-case ones", () => {
    expect(materialIconName("local_atm")).toBe("local-atm")
    expect(materialIconName("storefront")).toBe("storefront")
    expect(materialIconName("local_grocery_store")).toBe("local-grocery-store")
  })

  it("substitutes the Material Symbols names the bundled font has no glyph for", () => {
    // Dentists alone are ~200 places; a blank pin would be worse than a stand-in.
    expect(materialIconName("dentistry")).toBe("medical-services")
    expect(materialIconName("sauna")).toBe("hot-tub")
    expect(materialIconName("camping")).toBe("festival")
  })

  it("falls back to a neutral marker for a name it has never seen", () => {
    // The icon set is server-driven, so this is the normal case for new tags.
    expect(materialIconName("a_tag_invented_next_year")).toBe(BTCMAP_FALLBACK_ICON)
    expect(materialIconName(undefined)).toBe(BTCMAP_FALLBACK_ICON)
    expect(materialIconName("")).toBe(BTCMAP_FALLBACK_ICON)
  })
})
