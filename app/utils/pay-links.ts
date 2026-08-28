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

/**
 * `displayCurrency` becomes the terminal's `display` query param, which pre-selects the
 * currency the point of sale prices in. The terminal falls back to USD for codes it does
 * not know, so passing our own setting through stays safe if the two lists ever drift.
 */
export const getPosUrl = (address: string, displayCurrency?: string): string => {
  const posUrl = `${TERMINAL_URL}/${encodeUsername(address)}`
  if (!displayCurrency) return posUrl
  return `${posUrl}?display=${encodeURIComponent(displayCurrency)}`
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

const LIGHTNING_ADDRESS_PARTS = 2

/**
 * One account answers on more than one of our own hosts: `pay.blink.sv` fronts the point
 * of sale and `pay.bbw.sv` is the legacy Bitcoin Beach domain, and each one names itself
 * in the address it serves back. The app spells an account with a single hostname
 * everywhere it shows one, so an address that is ours is restated with that hostname.
 * An address served by anyone else is left exactly as it was declared.
 */
export const canonicalizeOwnLightningAddress = ({
  lightningAddress,
  ownDomains,
  lnAddressHostname,
}: {
  lightningAddress: string
  ownDomains: string[]
  lnAddressHostname: string | undefined
}): string => {
  if (!lnAddressHostname) return lightningAddress

  const parts = lightningAddress.split("@")
  if (parts.length !== LIGHTNING_ADDRESS_PARTS) return lightningAddress

  const [username, domain] = parts
  const isOwnDomain = ownDomains.some(
    (ownDomain) => ownDomain.toLowerCase() === domain.toLowerCase(),
  )
  if (!username || !isOwnDomain) return lightningAddress

  return `${username}@${lnAddressHostname}`
}
