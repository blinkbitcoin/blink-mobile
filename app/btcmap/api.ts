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
import {
  BtcMapPlace,
  BtcMapPlaceDetails,
  BtcMapPlaceDetailsWire,
  BtcMapPlaceWire,
} from "./types"

// Fields the map itself needs. Everything else is fetched per place, on tap.
// `deleted_at` is load-bearing twice over: it is how we learn about removals,
// and asking for it is what makes the API include tombstones at all.
const LIST_FIELDS = "id,lat,lon,icon,boosted_until,updated_at,deleted_at"

// BTC Map exposes raw OpenStreetMap tags under an `osm:` prefix. Payment
// methods and the contact fallbacks have no first-class field, so they only
// arrive this way — and the response keys keep the prefix.
const PAYMENT_TAGS = {
  lightning: "osm:payment:lightning",
  onchain: "osm:payment:onchain",
  contactless: "osm:payment:lightning_contactless",
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

// btcmap.org refuses to hand a user off to an arbitrary scheme, and neither do we.
const PAYMENT_URI_SCHEMES = ["http:", "https:", "lightning:", "bitcoin:", "mailto:"]

const isRenderablePlace = (place: BtcMapPlaceWire): boolean =>
  !place.deleted_at && typeof place.lat === "number" && typeof place.lon === "number"

const toPlace = (place: BtcMapPlaceWire): BtcMapPlace => ({
  id: place.id,
  latitude: place.lat as number,
  longitude: place.lon as number,
  icon: place.icon ?? "",
  boostedUntil: place.boosted_until,
})

// The single place the wire object is read outside its declared fields, so the
// cast is contained and a typo in a *named* field still fails to compile.
const osmTag = (wire: BtcMapPlaceDetailsWire, tag: string): string | undefined => {
  const value = (wire as Record<string, unknown>)[tag]
  return typeof value === "string" ? value : undefined
}

const acceptsTag = (wire: BtcMapPlaceDetailsWire, tag: string): boolean =>
  osmTag(wire, tag) === "yes"

const paymentUrl = (wire: BtcMapPlaceDetailsWire): string | undefined => {
  const uri = osmTag(wire, PAYMENT_TAGS.uri)?.trim()
  if (uri) {
    const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(uri)?.[0].toLowerCase()
    return scheme && PAYMENT_URI_SCHEMES.includes(scheme) ? uri : undefined
  }

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
  acceptsLightning: acceptsTag(wire, PAYMENT_TAGS.lightning),
  acceptsOnchain: acceptsTag(wire, PAYMENT_TAGS.onchain),
  acceptsContactless: acceptsTag(wire, PAYMENT_TAGS.contactless),
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
  const response = await axios.get<BtcMapPlaceWire[]>(BTCMAP_PLACES_CDN_URL, {
    timeout: BTCMAP_SNAPSHOT_TIMEOUT_MS,
  })

  const lastModified = response.headers["last-modified"]
  const generatedAt = lastModified ? new Date(lastModified).getTime() : NaN

  return {
    places: response.data.filter(isRenderablePlace).map(toPlace),
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
  const changed = new Map<number, BtcMapPlaceWire>()

  const rewind = (timestamp: string) =>
    new Date(new Date(timestamp).getTime() - 1).toISOString()

  let cursor = since
  let newestSeen: string | undefined

  for (let page = 0; page < BTCMAP_MAX_PAGES; page += 1) {
    const { data } = await axios.get<BtcMapPlaceWire[]>(`${BTCMAP_API_BASE_URL}/places`, {
      params: {
        // eslint-disable-next-line camelcase
        updated_since: cursor,
        limit: BTCMAP_PAGE_SIZE,
        fields: LIST_FIELDS,
      },
      timeout: BTCMAP_REQUEST_TIMEOUT_MS,
    })

    if (!data.length) break

    const firstUpdatedAt = data[0]?.updated_at
    const lastUpdatedAt = data[data.length - 1]?.updated_at

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
      changed.set(place.id, place)
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

export const fetchPlaceDetails = async (id: number): Promise<BtcMapPlaceDetails> => {
  const { data } = await axios.get<BtcMapPlaceDetailsWire>(
    `${BTCMAP_API_BASE_URL}/places/${id}`,
    { params: { fields: DETAIL_FIELDS }, timeout: BTCMAP_REQUEST_TIMEOUT_MS },
  )

  return toPlaceDetails(data)
}
