import axios from "axios"

import {
  BTCMAP_API_BASE_URL,
  BTCMAP_CDN_CURSOR_BACKDATE_MS,
  BTCMAP_EPOCH,
  BTCMAP_MAX_PAGES,
  BTCMAP_PAGE_SIZE,
  BTCMAP_PLACES_CDN_URL,
  BTCMAP_REQUEST_TIMEOUT_MS,
  BTCMAP_SNAPSHOT_TIMEOUT_MS,
} from "./config"
import { LatLng } from "./geo"
import {
  BtcMapNamedPlace,
  BtcMapPlace,
  BtcMapPlaceDetails,
  BtcMapPlaceDetailsWire,
  BtcMapPlaceWire,
} from "./types"
import { paymentUri } from "./urls"

// Fields the map itself needs. Everything else is fetched per place, on tap.
// `deleted_at` is load-bearing twice over: it is how we learn about removals,
// and asking for it is what makes the API include tombstones at all.
const LIST_FIELDS = "id,lat,lon,icon,boosted_until,updated_at,deleted_at"

// BTC Map exposes raw OpenStreetMap tags under an `osm:` prefix. The payment
// URI and the contact fallbacks have no first-class field, so they only arrive
// this way — and the response keys keep the prefix.
const PAYMENT_TAGS = {
  uri: "osm:payment:uri",
  pouch: "osm:payment:pouch",
  coinos: "osm:payment:coinos",
} as const

const CONTACT_TAGS = {
  phone: "osm:contact:phone",
  website: "osm:contact:website",
  email: "osm:contact:email",
  twitter: "osm:contact:twitter",
  facebook: "osm:contact:facebook",
  instagram: "osm:contact:instagram",
} as const

const DETAIL_FIELDS = [
  "id",
  "name",
  "address",
  "phone",
  "website",
  "email",
  "opening_hours",
  "verified_at",
  "description",
  "twitter",
  "facebook",
  "instagram",
  "boosted_until",
  "required_app_url",
  "osm_id",
  ...Object.values(PAYMENT_TAGS),
  ...Object.values(CONTACT_TAGS),
].join(",")

type IdentifiedPlaceWire = BtcMapPlaceWire & { id: number }
type RenderablePlaceWire = IdentifiedPlaceWire & {
  lat: number
  lon: number
  icon: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string"

const isNullableString = (value: unknown): value is string | null | undefined =>
  value === null || isOptionalString(value)

const isCoordinate = (value: unknown, minimum: number, maximum: number): boolean =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum

// The Axios type parameter is compile-time only. Keep every value from the
// third-party feed unknown until it has passed these runtime checks.
const isIdentifiedPlace = (value: unknown): value is IdentifiedPlaceWire => {
  if (!isRecord(value)) return false

  return (
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    (value.lat === undefined || isCoordinate(value.lat, -90, 90)) &&
    (value.lon === undefined || isCoordinate(value.lon, -180, 180)) &&
    (value.icon === undefined || typeof value.icon === "string") &&
    isOptionalString(value.boosted_until) &&
    isOptionalString(value.updated_at) &&
    isNullableString(value.deleted_at)
  )
}

// Narrows by intersection rather than replacement, so a wire that carries more
// than the renderable fields — the search wire, with its names and addresses —
// keeps them through a `filter`.
const isRenderablePlace = <T>(value: T): value is T & RenderablePlaceWire =>
  isIdentifiedPlace(value) &&
  (value.deleted_at === undefined || value.deleted_at === null) &&
  isCoordinate(value.lat, -90, 90) &&
  isCoordinate(value.lon, -180, 180) &&
  typeof value.icon === "string"

const placeRows = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("BTC Map returned a non-array place list")
  return value
}

const toPlace = (place: RenderablePlaceWire): BtcMapPlace => ({
  id: place.id,
  latitude: place.lat,
  longitude: place.lon,
  icon: place.icon,
  boostedUntil: place.boosted_until,
})

// The single place the wire object is read outside its declared fields, so the
// cast is contained and a typo in a *named* field still fails to compile.
const osmTag = (wire: BtcMapPlaceDetailsWire, tag: string): string | undefined => {
  const value = (wire as Record<string, unknown>)[tag]
  return typeof value === "string" ? value : undefined
}

const paymentUrl = (wire: BtcMapPlaceDetailsWire): string | undefined => {
  // btcmap.org refuses to hand a user off to an arbitrary scheme, and neither
  // do we — see the allowlists in `urls.ts`, which every OSM-sourced link on
  // the sheet now goes through.
  const uri = osmTag(wire, PAYMENT_TAGS.uri)?.trim()
  if (uri) return paymentUri(uri)

  // The hosts are fixed, so this is not an open redirect — but an unencoded
  // username containing "/" or "?" would silently change what the URL means.
  const pouch = osmTag(wire, PAYMENT_TAGS.pouch)
  if (pouch) return `https://app.pouch.ph/${encodeURIComponent(pouch)}`

  const coinos = osmTag(wire, PAYMENT_TAGS.coinos)
  if (coinos) return `https://coinos.io/${encodeURIComponent(coinos)}`

  return undefined
}

export const toPlaceDetails = (wire: BtcMapPlaceDetailsWire): BtcMapPlaceDetails => ({
  id: wire.id,
  name: wire.name,
  address: wire.address,
  // BTC Map promotes a handful of tags to first-class fields but keeps the raw
  // `contact:*` ones as the fallback, exactly as btcmap.org reads them.
  phone: wire.phone ?? osmTag(wire, CONTACT_TAGS.phone),
  website: wire.website ?? osmTag(wire, CONTACT_TAGS.website),
  email: wire.email ?? osmTag(wire, CONTACT_TAGS.email),
  twitter: wire.twitter ?? osmTag(wire, CONTACT_TAGS.twitter),
  facebook: wire.facebook ?? osmTag(wire, CONTACT_TAGS.facebook),
  instagram: wire.instagram ?? osmTag(wire, CONTACT_TAGS.instagram),
  openingHours: wire.opening_hours,
  verifiedAt: wire.verified_at,
  description: wire.description,
  boostedUntil: wire.boosted_until,
  requiredAppUrl: wire.required_app_url,
  osmId: wire.osm_id,
  paymentUrl: paymentUrl(wire),
})

/**
 * The whole place list, straight off BTC Map's CDN. One gzipped ~550 KB response
 * instead of the six uncompressed API pages a cold `updated_since=epoch` walk
 * would cost.
 *
 * The returned cursor is deliberately backdated. The CDN stamp is the time the
 * snapshot was *generated*, which runs minutes ahead of the newest record it
 * contains, and an edge may serve a day-old copy — so trusting it verbatim would
 * permanently skip whatever changed in that gap. Rewinding it just means the
 * first delta re-fetches a little we already have.
 */
export const fetchPlacesSnapshot = async (): Promise<{
  places: BtcMapPlace[]
  syncedUpTo: string
}> => {
  const response = await axios.get<unknown>(BTCMAP_PLACES_CDN_URL, {
    timeout: BTCMAP_SNAPSHOT_TIMEOUT_MS,
  })

  const lastModified = response.headers["last-modified"]
  const generatedAt = lastModified ? new Date(lastModified).getTime() : NaN

  return {
    places: placeRows(response.data).filter(isRenderablePlace).map(toPlace),
    syncedUpTo: Number.isNaN(generatedAt)
      ? BTCMAP_EPOCH
      : new Date(generatedAt - BTCMAP_CDN_CURSOR_BACKDATE_MS).toISOString(),
  }
}

export type BtcMapDelta = {
  // Places added or moved since the cursor.
  upserted: BtcMapPlace[]
  // Places that went away, or lost the coordinates that let us draw them.
  removedIds: number[]
  // Cursor to hand back on the next sync.
  syncedUpTo: string
  // Set when paging cannot get past a timestamp without losing rows, so the
  // only lossless way forward is to throw the cache away and start over.
  needsReseed: boolean
}

/**
 * Walk `/places?updated_since=…` until the API runs out of changes.
 *
 * `updated_since` is exclusive and the API orders by `updated_at, id` while
 * paging on `updated_at` alone, so a page boundary landing inside a group of
 * rows that share a timestamp would drop the rest of that group — and 11% of
 * rows share their timestamp with another. Rewinding the cursor by a millisecond
 * re-serves that whole group; rows are collected into a map keyed by id so the
 * overlap is an overwrite rather than a duplicate pin.
 */
export const fetchPlacesDelta = async (since: string): Promise<BtcMapDelta> => {
  // Last write wins: a place edited twice since the cursor appears twice, and
  // the later copy is the current one.
  const changed = new Map<number, IdentifiedPlaceWire>()

  const rewind = (timestamp: string) =>
    new Date(new Date(timestamp).getTime() - 1).toISOString()

  let cursor = since
  let newestSeen: string | undefined

  for (let page = 0; page < BTCMAP_MAX_PAGES; page += 1) {
    const response = await axios.get<unknown>(`${BTCMAP_API_BASE_URL}/places`, {
      params: {
        // eslint-disable-next-line camelcase
        updated_since: cursor,
        limit: BTCMAP_PAGE_SIZE,
        fields: LIST_FIELDS,
      },
      timeout: BTCMAP_REQUEST_TIMEOUT_MS,
    })
    const data = placeRows(response.data)

    if (!data.length) break

    const first = data[0]
    const last = data[data.length - 1]
    const firstUpdatedAt = isIdentifiedPlace(first) ? first.updated_at : undefined
    const lastUpdatedAt = isIdentifiedPlace(last) ? last.updated_at : undefined

    // A full page that begins and ends on the same timestamp may have more rows
    // at that timestamp behind it, and no cursor can reach them.
    if (
      data.length >= BTCMAP_PAGE_SIZE &&
      firstUpdatedAt &&
      firstUpdatedAt === lastUpdatedAt
    ) {
      return { upserted: [], removedIds: [], syncedUpTo: since, needsReseed: true }
    }

    for (const place of data) {
      if (isIdentifiedPlace(place)) changed.set(place.id, place)
    }

    if (lastUpdatedAt) newestSeen = lastUpdatedAt
    const nextCursor = lastUpdatedAt ? rewind(lastUpdatedAt) : cursor

    // A short page means we caught up.
    if (data.length < BTCMAP_PAGE_SIZE || nextCursor === cursor) break
    cursor = nextCursor
  }

  const upserted: BtcMapPlace[] = []
  const removedIds: number[] = []
  for (const place of changed.values()) {
    if (isRenderablePlace(place)) {
      upserted.push(toPlace(place))
    } else {
      removedIds.push(place.id)
    }
  }

  // Rewound for the same reason the paging cursor is: the next sync should
  // re-serve everything sharing the newest timestamp rather than risk stepping
  // over a sibling that landed a moment later. Never backwards though — a
  // cursor that regresses replays the same page on every launch forever.
  const rewound = newestSeen ? rewind(newestSeen) : since
  const syncedUpTo =
    new Date(rewound).getTime() > new Date(since).getTime() ? rewound : since

  return { upserted, removedIds, syncedUpTo, needsReseed: false }
}

// The search endpoint answers with the detail shape *and* the list shape's
// geometry, which is what makes it the one endpoint that can place a result on
// the map and say what it is called.
type BtcMapSearchWire = BtcMapPlaceWire & BtcMapPlaceDetailsWire

/**
 * Every named place within `radiusKm` of a point, in one request.
 *
 * The offline snapshot has no names — the CDN dump does not carry them — so both
 * the map labels and the search list come from here rather than from bloating
 * that snapshot with all ~29k. At the zoom labels appear this is a sub-kilometre
 * radius: a handful of places and a couple of KB, against 2.8 MB for the full
 * uncompressed name list.
 *
 * The endpoint ignores `fields` and `limit` and always returns everything in the
 * circle, so the radius is the only thing that bounds the response — see the
 * caps in `use-place-search.ts`. Rows without a name or coordinates are dropped:
 * they can neither be matched against what was typed nor drawn where they are.
 */
export const fetchPlacesNear = async (
  center: LatLng,
  radiusKm: number,
): Promise<BtcMapNamedPlace[]> => {
  const { data } = await axios.get<BtcMapSearchWire[]>(
    `${BTCMAP_API_BASE_URL}/places/search`,
    {
      params: {
        lat: center.latitude,
        lon: center.longitude,
        // eslint-disable-next-line camelcase
        radius_km: radiusKm,
      },
      timeout: BTCMAP_REQUEST_TIMEOUT_MS,
    },
  )

  return data.filter(isRenderablePlace).flatMap((place) => {
    const name = place.name?.trim()
    if (!name) return []

    const address = place.address?.trim()
    return [{ ...toPlace(place), name, ...(address ? { address } : {}) }]
  })
}

/** Just the names, for the labels drawn under the pins. */
export const fetchPlaceNamesNear = async (
  center: LatLng,
  radiusKm: number,
): Promise<Map<number, string>> =>
  new Map((await fetchPlacesNear(center, radiusKm)).map(({ id, name }) => [id, name]))

export const fetchPlaceDetails = async (id: number): Promise<BtcMapPlaceDetails> => {
  const { data } = await axios.get<BtcMapPlaceDetailsWire>(
    `${BTCMAP_API_BASE_URL}/places/${id}`,
    { params: { fields: DETAIL_FIELDS }, timeout: BTCMAP_REQUEST_TIMEOUT_MS },
  )

  return toPlaceDetails(data)
}
