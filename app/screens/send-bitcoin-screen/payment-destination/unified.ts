import { utils } from "lnurl-pay"

// Extracts an LNURL from the `lightning=` param of a BIP-21 unified URI.
// Returns undefined when there is no lightning param or it is not an LNURL
// (e.g. bolt11 invoices, which parsePaymentDestination already handles).
// Matching is case-insensitive: BTCPay QR codes are often fully uppercase,
// which parsePaymentDestination misses and classifies as plain onchain.
export const getLnurlFromUnifiedUri = (rawInput: string): string | undefined => {
  const match = rawInput.match(/[?&]lightning=([^&\s]+)/i)
  if (!match) {
    return undefined
  }

  let value = match[1]
  try {
    value = decodeURIComponent(value)
  } catch {
    // keep the raw value on malformed percent-encoding
  }

  return utils.parseLnUrl(value) ?? undefined
}
