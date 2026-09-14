import {
  CATEGORY_ICONS,
  PLACE_CATEGORIES,
  PlaceCategory,
  categoryOf,
  placesInCategories,
} from "@app/btcmap/categories"
import { BtcMapPlace } from "@app/btcmap/types"

const place = (id: number, icon: string): BtcMapPlace => ({
  id,
  latitude: 51.5,
  longitude: -0.12,
  icon,
})

describe("categoryOf", () => {
  it("buckets the icons the feed actually spells snake_case", () => {
    expect(categoryOf("local_cafe")).toBe("cafes")
    expect(categoryOf("local_atm")).toBe("money")
    expect(categoryOf("local_gas_station")).toBe("automotive")
  })

  it("buckets the same icon spelled the way the font names it", () => {
    // `materialIconName` reshapes these to kebab-case on the way to the pin, so
    // a place already carrying that spelling must not fall out of its bucket.
    expect(categoryOf("local-cafe")).toBe("cafes")
    expect(categoryOf("LOCAL_CAFE")).toBe("cafes")
  })

  it("sends an icon it has never heard of to the catch-all", () => {
    // BTC Map's icon set is server-driven and grows without us; a new one has to
    // stay reachable rather than vanish from a filtered map.
    expect(categoryOf("teleporter")).toBe("other")
    expect(categoryOf("")).toBe("other")
    expect(categoryOf(undefined)).toBe("other")
  })
})

describe("PLACE_CATEGORIES", () => {
  it("lists every bucket exactly once, catch-all included", () => {
    // The filter is only honest if switching everything on can reach every
    // place — a bucket missing from this list would be unfilterable.
    const defined: PlaceCategory[] = [
      ...(Object.keys(CATEGORY_ICONS) as PlaceCategory[]),
      "other",
    ]

    expect([...PLACE_CATEGORIES].sort()).toEqual(defined.sort())
  })

  it("never files one icon under two categories", () => {
    const icons = Object.values(CATEGORY_ICONS).flatMap((list) => [...list])

    expect(icons).toHaveLength(new Set(icons).size)
  })
})

describe("placesInCategories", () => {
  const places = [place(1, "restaurant"), place(2, "local_atm"), place(3, "teleporter")]

  it("keeps only what was asked for", () => {
    expect(placesInCategories(places, new Set(["money"]))).toEqual([places[1]])
  })

  it("keeps the unrecognised icons when the catch-all is on", () => {
    expect(placesInCategories(places, new Set(["other"]))).toEqual([places[2]])
  })

  it("treats an empty selection as no filter rather than no places", () => {
    // A map that went blank as the last toggle was switched off would read as
    // broken, and there would be no way back to the whole map.
    expect(placesInCategories(places, new Set())).toEqual(places)
  })

  it("hands back the very same array when nothing is filtered", () => {
    // The clusterer rebuilds its index over all ~29k points whenever this array
    // changes identity, so an unfiltered map must not pay for a copy per render.
    expect(placesInCategories(places, new Set())).toBe(places)
  })
})
