import { PlaceCategory, categoryOf } from "./categories"
import { LatLng, distanceKm } from "./geo"
import { BtcMapNamedPlace } from "./types"

/**
 * Fold a name down to what someone typing at speed on a phone will actually
 * produce: case and accents dropped, so "cafe" finds "Café Olé" — the names come
 * from OpenStreetMap in whatever script and diacritics the place uses locally,
 * while the keyboard is whatever the user happens to have.
 *
 * Only the marks are stripped, never the letters carrying them, so scripts with
 * no decomposition (Cyrillic, Thai, CJK) are left exactly as typed rather than
 * mangled into something that matches nothing.
 */
export const foldForSearch = (text: string): string =>
  text
    .normalize("NFD")
    // The combining diacritical marks block, i.e. the accents NFD just split off.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

export type PlaceSearchResult = {
  place: BtcMapNamedPlace
  /** How far the place is from `origin`. */
  distanceKm: number
}

type Options = {
  places: BtcMapNamedPlace[]
  query: string
  /**
   * Where "nearest" is measured from: the phone's own position when it is
   * known, since that is the distance the list reports. Ranking and the number
   * on the row have to come from the same point, or the list reads as unsorted.
   */
  origin: LatLng
  categories: ReadonlySet<PlaceCategory>
  limit: number
}

/**
 * The places worth listing for what has been typed, nearest first.
 *
 * Substring rather than fuzzy: a wrong-but-plausible match on this list sends
 * someone walking to the wrong shop, and "did you mean" guesses are not worth
 * that. An empty query is not an empty result — it is the list of what is
 * nearby, which is the useful thing to show before a search has been typed.
 *
 * The category filter applies here as well as to the pins. Someone who has just
 * narrowed the map to groceries and then searches is still looking for
 * groceries, and a list that ignored the filter would contradict the map behind
 * it.
 */
export const searchPlaces = ({
  places,
  query,
  origin,
  categories,
  limit,
}: Options): PlaceSearchResult[] => {
  const needle = foldForSearch(query)

  const matches = (
    needle ? places.filter((place) => foldForSearch(place.name).includes(needle)) : places
  ).filter((place) => !categories.size || categories.has(categoryOf(place.icon)))

  return matches
    .map((place) => ({ place, distanceKm: distanceKm(origin, place) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}
