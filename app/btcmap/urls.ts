import { BTCMAP_SITE_URL } from "./config"
import { BtcMapPlaceDetails } from "./types"

// Any scheme, not just the ones with an authority: "mailto:" and "lightning:"
// have no "//" and must not be treated as schemeless.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

// Starts with dotted labels and then ends or turns into a path — so
// "x.com/satoshi" is a host but "a/../b" is a handle, even though both contain
// a dot. Instagram handles may contain dots, which is why the shape matters
// rather than the mere presence of one.
const LOOKS_LIKE_HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i

/** btcmap.org shows the bare host, which is all anyone reads off a link anyway. */
export const hostOf = (url: string): string =>
  url
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]

/** OSM website values are as often "example.com" as "https://example.com". */
export const withScheme = (url: string): string => {
  const trimmed = url.trim()
  return HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * OSM stores `contact:instagram` and friends as either a full URL or a bare
 * handle, and plenty of BTC Map's are handles. Prefixing a handle with
 * `https://` yields `https://@someone`, which resolves to nothing — so a value
 * with no host is treated as a username on the platform's own domain.
 */
export const socialUrl = (host: string, value: string): string => {
  const trimmed = value.trim()
  if (HAS_SCHEME.test(trimmed)) return trimmed
  if (LOOKS_LIKE_HOST.test(trimmed)) return `https://${trimmed}`
  return `https://${host}/${encodeURIComponent(trimmed.replace(/^@/, ""))}`
}

/** The place's page on btcmap.org, by OSM id where we have one. */
export const merchantUrl = (
  details: BtcMapPlaceDetails | null,
  placeId: number,
): string => `${BTCMAP_SITE_URL}/merchant/${details?.osmId ?? placeId}`

/**
 * A platform maps URL for a coordinate. Without a name there is nothing to
 * label the pin with, and an empty label turns both platforms' URLs into a text
 * search that finds nothing — so the bare-coordinate form is used instead.
 */
export const directionsUrl = (
  place: { latitude: number; longitude: number },
  name: string | undefined,
  platform: "ios" | "android",
): string => {
  const { latitude, longitude } = place
  const label = name ? encodeURIComponent(name) : ""

  if (platform === "ios") {
    return label
      ? `maps:0,0?q=${label}@${latitude},${longitude}`
      : `maps:0,0?ll=${latitude},${longitude}`
  }

  return label
    ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`
    : `geo:${latitude},${longitude}?q=${latitude},${longitude}`
}

/** Web links get the in-app browser; tel:, geo:/maps: and lightning: must not. */
export const isWebUrl = (url: string): boolean => /^https?:\/\//i.test(url.trim())
