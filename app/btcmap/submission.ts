import { PlaceCategory } from "./categories"
import { LatLng } from "./geo"

/**
 * A place someone is adding to BTC Map, as they are filling it in. Every field
 * is whatever is currently in the form, so nothing here is trusted to be
 * complete — see `buildPlaceSubmission`.
 */
export type PlaceSubmissionDraft = {
  name: string
  address: string
  category: PlaceCategory | null
  location: LatLng | null
}

/** A draft with everything a submission needs, ready to be sent. */
export type PlaceSubmission = {
  name: string
  /** Absent rather than empty when nobody typed one: it is optional. */
  address?: string
  category: PlaceCategory
  latitude: number
  longitude: number
}

// Long enough for a name with its branch in it, short enough that the field is
// not a way to write a paragraph onto someone else's map.
export const PLACE_NAME_MAX_LENGTH = 120
export const PLACE_ADDRESS_MAX_LENGTH = 240

const isLatitude = (value: number) => Number.isFinite(value) && Math.abs(value) <= 90
const isLongitude = (value: number) => Number.isFinite(value) && Math.abs(value) <= 180

/**
 * The submission a draft amounts to, or null while it is still missing
 * something.
 *
 * A name and a category are both required. The name is the only thing that
 * identifies the place to whoever surveys it, and the category is what the map
 * draws — BTC Map classifies a place by the icon on its pin, so a place with no
 * category has no pin (see `categories.ts`).
 *
 * The coordinates come from a pin dropped on the map rather than typed, so they
 * are checked for range rather than parsed: what this rules out is a submission
 * built before anything was placed.
 */
export const buildPlaceSubmission = (
  draft: PlaceSubmissionDraft,
): PlaceSubmission | null => {
  const name = draft.name.trim().slice(0, PLACE_NAME_MAX_LENGTH)
  const address = draft.address.trim().slice(0, PLACE_ADDRESS_MAX_LENGTH)

  if (!name || !draft.category || !draft.location) return null

  const { latitude, longitude } = draft.location
  if (!isLatitude(latitude) || !isLongitude(longitude)) return null

  return {
    name,
    ...(address ? { address } : {}),
    category: draft.category,
    latitude,
    longitude,
  }
}

// Six decimal places is ~11 cm at the equator, which is finer than any phone's
// fix and finer than a pin can be placed by hand. It is also how OpenStreetMap
// itself rounds, so a coordinate read off this screen matches the one that ends
// up on the map.
const COORDINATE_DECIMALS = 6

/** The dropped pin's position, for showing back to whoever dropped it. */
export const formatCoordinates = ({ latitude, longitude }: LatLng): string =>
  `${latitude.toFixed(COORDINATE_DECIMALS)}, ${longitude.toFixed(COORDINATE_DECIMALS)}`
