// BTC Map (https://btcmap.org) is the community-maintained OpenStreetMap overlay
// of merchants that accept bitcoin. This app is a read-only consumer of it:
// we never create, edit or verify places from here.

export const BTCMAP_PLACES_CDN_URL = "https://cdn.static.btcmap.org/api/v4/places.json"
export const BTCMAP_API_BASE_URL = "https://api.btcmap.org/v4"
export const BTCMAP_SITE_URL = "https://btcmap.org"

// Where the ODbL credit points. OSM asks that the licence be one tap from
// the data, and this is the page they nominate for it.
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright"

// The v4 list endpoint caps a page at this many rows.
export const BTCMAP_PAGE_SIZE = 5000

// Safety net for the `updated_since` pagination loop: at ~30k places a full
// resync is 6 pages, so anything past this means the cursor stopped advancing.
export const BTCMAP_MAX_PAGES = 40

// The oldest timestamp the API accepts as a cursor, i.e. "give me everything".
export const BTCMAP_EPOCH = "1970-01-01T00:00:00Z"

// How far to rewind the CDN snapshot's Last-Modified before using it as a sync
// cursor. The stamp is the snapshot's generation time — minutes ahead of the
// newest record in it — and the CDN caches for a day, so anything shorter than
// a day plus slack would silently skip edits.
export const BTCMAP_CDN_CURSOR_BACKDATE_MS = 48 * 60 * 60 * 1000

// How stale the cached snapshot may get before we ask the API for a delta.
export const BTCMAP_SYNC_INTERVAL_MS = 60 * 60 * 1000

// Network budget. The CDN snapshot is ~2 MB, so it needs a longer rope than the
// small per-place detail requests.
export const BTCMAP_SNAPSHOT_TIMEOUT_MS = 60 * 1000
export const BTCMAP_REQUEST_TIMEOUT_MS = 15 * 1000

// btcmap.org treats a survey as stale after a year and starts asking people to
// re-verify the place. We show the same distinction, we just can't act on it.
export const BTCMAP_VERIFICATION_VALID_FOR_DAYS = 365
