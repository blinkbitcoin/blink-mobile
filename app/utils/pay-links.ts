const DONATION_BUTTON_URL = "https://donation-button.blink.sv"

/**
 * Usernames are constrained to `[0-9a-z_]` by validateUsername before they can be
 * registered, so this is a no-op for every well-formed value. It exists because the
 * value we interpolate arrives from the server or the Breez SDK rather than from
 * that check: a username carrying `/`, `?` or `#` would otherwise silently alter
 * the path or query of the link we open.
 */
const encodeUsername = (address: string): string => encodeURIComponent(address)

export const getPosUrl = (posUrl: string, address: string): string => {
  return `${posUrl}/${encodeUsername(address)}`
}

export const getPrintableQrCodeUrl = (posUrl: string, address: string): string => {
  return `${posUrl}/${encodeUsername(address)}/print`
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
