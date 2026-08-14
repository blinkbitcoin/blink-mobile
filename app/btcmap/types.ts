// Wire shapes returned by the BTC Map v4 API. Fields are snake_case on the wire;
// everything downstream of `api.ts` uses the camelCase domain types below.

export type BtcMapPlaceWire = {
  id: number
  lat?: number
  lon?: number
  icon?: string
  boosted_until?: string
  updated_at?: string
  deleted_at?: string | null
}

// The index signature carries the raw OpenStreetMap tags BTC Map passes through
// under an `osm:` prefix — "osm:payment:lightning" and friends. Those keys are
// not identifiers, so they are read by index.
export type BtcMapPlaceDetailsWire = {
  [tag: string]: string | number | undefined
  id: number
  name?: string
  address?: string
  phone?: string
  website?: string
  email?: string
  opening_hours?: string
  verified_at?: string
  description?: string
  twitter?: string
  facebook?: string
  instagram?: string
  boosted_until?: string
  required_app_url?: string
  osm_id?: string
}

// A pin on the map. This is all we keep for the ~30k places we hold offline, so
// it is deliberately tiny — details are fetched per place on tap.
export type BtcMapPlace = {
  id: number
  latitude: number
  longitude: number
  icon: string
  // Paid promotion. While this is in the future BTC Map draws the pin orange.
  boostedUntil?: string
}

export type BtcMapSnapshot = {
  places: BtcMapPlace[]
  // Cursor for the next incremental sync: the `updated_at` we have caught up to.
  syncedUpTo: string
  // When we last talked to the API, so we don't re-sync on every screen focus.
  lastSyncedAt: string
}

export type BtcMapPlaceDetails = {
  id: number
  name?: string
  address?: string
  phone?: string
  website?: string
  email?: string
  twitter?: string
  facebook?: string
  instagram?: string
  openingHours?: string
  verifiedAt?: string
  description?: string
  boostedUntil?: string
  // Some places can only be paid through a specific wallet or app.
  requiredAppUrl?: string
  // OSM identity, e.g. "node:12607455734" — the id btcmap.org uses in its URLs.
  osmId?: string
  // Where to send someone who wants to pay, if the place published one.
  paymentUrl?: string
  acceptsLightning: boolean
  acceptsOnchain: boolean
  acceptsContactless: boolean
}
