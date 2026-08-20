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

// Every field below arrives as a raw OpenStreetMap tag, which any volunteer can
// set to any string, and the sheet hands what it finds to the OS. That makes the
// scheme the security boundary: this app registers `bitcoin:`, `lightning:`,
// `lnurlp:`, `lnurlw:` and `blink:` on both platforms, so a `website` reading
// "bitcoin:bc1q…?amount=1" would re-enter our own send flow with a destination
// the merchant chose, from a row labelled with a globe icon and their hostname.
// A scheme is therefore only honoured where it makes sense for the field it came
// from, and anything else resolves to undefined so the row is never drawn.

/** A merchant's own links are web links. Nothing else belongs in those fields. */
const WEB_SCHEMES = ["http:", "https:"]

// Payment URIs are the one field that legitimately names a wallet scheme, which
// is why they get their own, wider list — the same one btcmap.org allows.
const PAYMENT_SCHEMES = [...WEB_SCHEMES, "lightning:", "bitcoin:", "mailto:"]

const schemeOf = (url: string): string | undefined =>
  HAS_SCHEME.exec(url)?.[0].toLowerCase()

const withAllowedScheme = (value: string, schemes: string[]): string | undefined =>
  schemes.includes(schemeOf(value) ?? "") ? value : undefined

/** btcmap.org shows the bare host, which is all anyone reads off a link anyway. */
export const hostOf = (url: string): string =>
  url
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]

/**
 * A merchant's web link, or undefined if the value is not one.
 *
 * OSM website values are as often "example.com" as "https://example.com", so a
 * schemeless value is upgraded. A value carrying some *other* scheme is not a
 * website that lost its prefix — it is something else wearing the label.
 */
export const webUrl = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return schemeOf(trimmed)
    ? withAllowedScheme(trimmed, WEB_SCHEMES)
    : `https://${trimmed}`
}

/** A payment URI we are willing to hand the user off to, or undefined. */
export const paymentUri = (value: string): string | undefined =>
  withAllowedScheme(value.trim(), PAYMENT_SCHEMES)

/**
 * `tel:` is ours rather than the tag's, but the number inside it is not.
 * Android hands a `tel:` URI to the dialer pre-filled instead of dialling it,
 * yet an MMI sequence (`*21*…#` forwards every call) sitting in the dialer one
 * tap from being sent is not something a contact tag should be able to arrange.
 */
export const telUrl = (phone: string): string | undefined => {
  const trimmed = phone.trim()
  // "*" and "#" are what turn a dial string into an MMI sequence rather than a
  // number, so finding them disqualifies the value instead of being cleaned out
  // of it — silently mangling a number just produces a wrong one.
  if (/[*#]/.test(trimmed)) return undefined

  const dialable = trimmed.replace(/[^\d+\-().\s]/g, "").trim()
  return dialable ? `tel:${dialable}` : undefined
}

/**
 * Likewise for `mailto:`: a "?" in the address turns everything after it into
 * mail headers, so a subject, body or bcc could be written by the tag.
 */
export const mailtoUrl = (email: string): string | undefined => {
  const trimmed = email.trim()
  return trimmed && !/[?\s]/.test(trimmed) ? `mailto:${trimmed}` : undefined
}

/**
 * OSM stores `contact:instagram` and friends as either a full URL or a bare
 * handle, and plenty of BTC Map's are handles. Prefixing a handle with
 * `https://` yields `https://@someone`, which resolves to nothing — so a value
 * with no host is treated as a username on the platform's own domain.
 */
export const socialUrl = (host: string, value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (schemeOf(trimmed)) return withAllowedScheme(trimmed, WEB_SCHEMES)
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
