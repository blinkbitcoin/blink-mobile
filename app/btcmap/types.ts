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

// Only the promoted fields are named. BTC Map also passes raw OpenStreetMap
// tags through under an `osm:` prefix — "osm:payment:lightning" and friends —
// but those keys are not identifiers and an index signature here would make
// every misspelled field name type-check, so they are read through `osmTag`.
export type BtcMapPlaceDetailsWire = {
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

// A place from the nearby-search endpoint, which — unlike the offline snapshot —
// knows what it is called. Named, because a place with no name is nothing a
// search can match and nothing a result row could show.
//
// The address comes along because it is what a result row has left to say when
// the phone does not know where it is and no distance can be worked out. Under
// half the places carry one, so it is a fallback, not a second subtitle.
export type BtcMapNamedPlace = BtcMapPlace & { name: string; address?: string }

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
}
