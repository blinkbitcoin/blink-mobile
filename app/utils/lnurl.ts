import { bech32 } from "bech32"

export const BareLnurlDecodeStatus = {
  NotBareLnurl: "not_bare_lnurl",
  Decoded: "decoded",
  DecodeError: "decode_error",
} as const

export type BareLnurlDecodeResult =
  | { status: typeof BareLnurlDecodeStatus.NotBareLnurl }
  | { status: typeof BareLnurlDecodeStatus.Decoded; url: string }
  | { status: typeof BareLnurlDecodeStatus.DecodeError }

// A bare bech32 LNURL (lnurl1...) embeds an arbitrary URL, and the LNURL
// libraries the app relies on (js-lnurl, lnurl-pay) fetch whatever scheme it
// decodes to without enforcing https. Decode it here so callers can vet the
// scheme before any network call. Decode failure is reported separately from
// non-bech32 input so callers reject instead of failing open: the app resolves
// bech32@2 while js-lnurl bundles bech32@1, and the two decoders need not agree
// on every input.
export const decodeBareLnurl = (lnurl: string): BareLnurlDecodeResult => {
  const trimmed = lnurl.trim()
  if (trimmed.toLowerCase().slice(0, 6) !== "lnurl1") {
    return { status: BareLnurlDecodeStatus.NotBareLnurl }
  }
  try {
    const url = Buffer.from(
      bech32.fromWords(bech32.decode(trimmed, 20000).words),
    ).toString()
    return { status: BareLnurlDecodeStatus.Decoded, url }
  } catch {
    return { status: BareLnurlDecodeStatus.DecodeError }
  }
}

// LUD-17 URI schemes are converted by js-lnurl to https URLs, or to plain http
// whenever ".onion" appears anywhere in the payload (it matches /\.onion($|\W)/;
// lnurl-pay likewise checks parsedUrl.includes(".onion")). Mirror that
// derivation so the scheme can be vetted before any network call.
const LUD17_SCHEME_PATTERN = /^(?:lnurlw|lnurlp|lnurlc|keyauth):\/\//i

export const lud17Url = (lnurl: string): string | null => {
  const trimmed = lnurl.trim()
  if (!LUD17_SCHEME_PATTERN.test(trimmed)) return null
  const payload = trimmed.split("://")[1]
  const scheme = payload.match(/\.onion($|\W)/) ? "http" : "https"
  return `${scheme}://${payload}`
}

export const isHttpsUrl = (url: string): boolean => {
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}
