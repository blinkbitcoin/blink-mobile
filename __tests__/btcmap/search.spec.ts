import { PlaceCategory } from "@app/btcmap/categories"
import { foldForSearch, searchPlaces } from "@app/btcmap/search"
import { BtcMapNamedPlace } from "@app/btcmap/types"

const ORIGIN = { latitude: 51.5, longitude: -0.12 }

// Roughly `metres` north of the origin.
const at = (
  id: number,
  name: string,
  { metres, icon = "restaurant" }: { metres: number; icon?: string },
): BtcMapNamedPlace => ({
  id,
  name,
  icon,
  latitude: ORIGIN.latitude + metres / 111_320,
  longitude: ORIGIN.longitude,
})

const search = (
  places: BtcMapNamedPlace[],
  query: string,
  { categories = new Set<PlaceCategory>(), limit = 10 } = {},
) => searchPlaces({ places, query, origin: ORIGIN, categories, limit })

const names = (results: ReturnType<typeof search>) =>
  results.map((result) => result.place.name)

describe("foldForSearch", () => {
  it("drops case and accents so a plain keyboard reaches an accented name", () => {
    expect(foldForSearch("  Café Olé ")).toBe("cafe ole")
  })

  it("leaves scripts that do not decompose exactly as they were typed", () => {
    // Stripping marks must not touch the letters carrying them, or a Thai or
    // Cyrillic name would fold into something no keystroke can match.
    expect(foldForSearch("Кафе")).toBe("кафе")
    expect(foldForSearch("ร้านกาแฟ")).toBe("ร้านกาแฟ")
  })
})

describe("searchPlaces", () => {
  const places = [
    at(1, "Food and wine shop", { metres: 200 }),
    at(2, "Arts and crafts", { metres: 600, icon: "palette" }),
    at(3, "Food for the People", { metres: 1100 }),
  ]

  it("lists what is nearby before anything has been typed", () => {
    // An empty query is not an empty result — it is the answer to "what is
    // around here", which is the useful thing to show first.
    expect(names(search(places, ""))).toEqual([
      "Food and wine shop",
      "Arts and crafts",
      "Food for the People",
    ])
  })

  it("orders by distance, not by the order the API answered in", () => {
    const shuffled = [places[2], places[1], places[0]]

    expect(names(search(shuffled, ""))).toEqual([
      "Food and wine shop",
      "Arts and crafts",
      "Food for the People",
    ])
  })

  it("matches anywhere in the name, ignoring case", () => {
    expect(names(search(places, "foo"))).toEqual([
      "Food and wine shop",
      "Food for the People",
    ])
    expect(names(search(places, "PEOPLE"))).toEqual(["Food for the People"])
  })

  it("finds nothing rather than guessing at a near miss", () => {
    // A plausible-but-wrong match sends someone walking to the wrong shop.
    expect(search(places, "Foooo")).toEqual([])
  })

  it("reports how far away each result is", () => {
    const [nearest] = search(places, "Food")

    expect(nearest.distanceKm).toBeCloseTo(0.2, 2)
  })

  it("obeys the category filter the map is already using", () => {
    // The list sits over a map that is showing less than everything; ignoring
    // the filter here would contradict it.
    const categories = new Set<PlaceCategory>(["shops"])

    expect(names(search(places, "", { categories }))).toEqual(["Arts and crafts"])
  })

  it("keeps the nearest results when there are more than fit", () => {
    expect(names(search(places, "", { limit: 2 }))).toEqual([
      "Food and wine shop",
      "Arts and crafts",
    ])
  })
})
