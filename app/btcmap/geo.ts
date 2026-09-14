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

// Where the user is looking is the one thing on the map screen that leaves the
// device describing where the user is, and every viewport-shaped request would
// otherwise send it to a third party at a zoom precise enough to be a street
// address. Snapping it to a ~1.1 km grid means every look around a neighbourhood
// asks the same question, so what BTC Map can see collapses from the path taken
// through an area to the cell it happened in.
const GRID_STEPS_PER_DEGREE = 100

export const snapToPrivacyGrid = (center: LatLng): LatLng => ({
  latitude: Math.round(center.latitude * GRID_STEPS_PER_DEGREE) / GRID_STEPS_PER_DEGREE,
  longitude: Math.round(center.longitude * GRID_STEPS_PER_DEGREE) / GRID_STEPS_PER_DEGREE,
})

// Half the diagonal of one grid cell, so a radius asked about the snapped centre
// still reaches wherever inside it the user actually is. Latitude dominates: a
// cell is at its widest at the equator, where 0.005° is ~0.56 km each way.
export const PRIVACY_GRID_SLACK_KM = 0.8

// Opening hours are stated in the place's local time, which a phone can only
// stand in for with its own. Inside this radius the two are the same clock in
// all but a handful of border cases; outside it, the answer is not ours to give.
export const OPENING_HOURS_TRUSTED_RADIUS_KM = 100

export const sharesClockWith = (user: LatLng | undefined, place: LatLng): boolean =>
  Boolean(user) && distanceKm(user as LatLng, place) <= OPENING_HOURS_TRUSTED_RADIUS_KM

// Under this, a distance is easier to picture as a number of paces than as a
// fraction of a kilometre.
const METRES_CUTOFF_KM = 0.5

// Rounded to something a walk can actually be measured to: nobody needs the
// third significant figure of how far away a shop is, and printing it implies a
// precision neither the survey nor the phone's fix has.
const METRES_STEP = 10
const ONE_DECIMAL_BELOW_KM = 10

export type DisplayDistance = { unit: "m" | "km"; value: number }

/** How far away to say something is, in the unit that reads best for it. */
export const displayDistance = (km: number): DisplayDistance => {
  const safe = Math.max(0, km)
  if (safe < METRES_CUTOFF_KM) {
    return { unit: "m", value: Math.round((safe * 1000) / METRES_STEP) * METRES_STEP }
  }
  return {
    unit: "km",
    value: safe < ONE_DECIMAL_BELOW_KM ? Math.round(safe * 10) / 10 : Math.round(safe),
  }
}
