export type LatLng = { latitude: number; longitude: number }

const EARTH_RADIUS_KM = 6371
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Great-circle distance, good enough to answer "is this place near me?". */
export const distanceKm = (from: LatLng, to: LatLng): number => {
  const dLat = toRadians(to.latitude - from.latitude)
  const dLng = toRadians(to.longitude - from.longitude)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Opening hours are stated in the place's local time, which a phone can only
// stand in for with its own. Inside this radius the two are the same clock in
// all but a handful of border cases; outside it, the answer is not ours to give.
export const OPENING_HOURS_TRUSTED_RADIUS_KM = 100

export const sharesClockWith = (user: LatLng | undefined, place: LatLng): boolean =>
  Boolean(user) && distanceKm(user as LatLng, place) <= OPENING_HOURS_TRUSTED_RADIUS_KM
