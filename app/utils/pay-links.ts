const DONATION_BUTTON_URL = "https://donation-button.blink.sv"

// The point of sale and its printable QR are served by the standalone terminal for
// every account, custodial or not, so the host is a constant here rather than the
// galoy instance posUrl. That config still points at the pay-server, which these
// links no longer use.
const TERMINAL_URL = "https://terminal.blinkbtc.com"

/**
 * Usernames are constrained to `[0-9a-z_]` by validateUsername before they can be
 * registered, so this is a no-op for every well-formed value. It exists because the
 * value we interpolate arrives from the server or the Breez SDK rather than from
 * that check: a username carrying `/`, `?` or `#` would otherwise silently alter
 * the path or query of the link we open.
 */
const encodeUsername = (address: string): string => encodeURIComponent(address)

export const getPosUrl = (address: string): string => {
  return `${TERMINAL_URL}/${encodeUsername(address)}`
}

export const getPrintableQrCodeUrl = (address: string): string => {
  return `${TERMINAL_URL}/${encodeUsername(address)}/print`
}

export const getDonationButtonUrl = (address: string): string => {
  return `${DONATION_BUTTON_URL}/${encodeUsername(address)}`
}

export const getLightningAddress = (
  lnAddressHostname: string,
  address: string,
): string => {
  if (address.includes("@")) return address
  return `${address}@${lnAddressHostname}`
}

export const extractLightningAddressUsername = (
  lightningAddress: string | null | undefined,
): string | null => {
  if (!lightningAddress) return null
  const [username] = lightningAddress.split("@")
  return username || null
}
