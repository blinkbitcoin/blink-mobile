import { bech32 } from "bech32"

// A bare bech32 LNURL (lnurl1...) embeds an arbitrary URL, and the LNURL
// libraries the app relies on (js-lnurl, lnurl-pay) fetch whatever scheme it
// decodes to without enforcing https. Decode it here so callers can vet the
// scheme before any network call. Returns null for non-bech32 forms (lightning
// addresses, lnurlw://, ...) or undecodable input.
export const decodeBareLnurl = (lnurl: string): string | null => {
  const trimmed = lnurl.trim()
  if (trimmed.toLowerCase().slice(0, 6) !== "lnurl1") return null
  try {
    return Buffer.from(bech32.fromWords(bech32.decode(trimmed, 20000).words)).toString()
  } catch {
    return null
  }
}

export const isHttpsUrl = (url: string): boolean => {
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}
