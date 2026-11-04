type AccountNameSource = {
  isActive: boolean
  liveLightningAddress: string | null | undefined
  persistedLightningAddress: string | null | undefined
  anonymousName: string
}

/** A blank address is no address: it must not mask a stored one or render an empty title. */
const presentAddress = (address: string | null | undefined): string | null =>
  address?.trim() || null

/**
 * The name a self-custodial account goes by in the account list, on the removal lock and
 * in the toast that says which account went. Every place derives it here, so the same
 * account can't be named one way in Switch account and another in the Danger zone.
 *
 * It is the full lightning address, domain included. The live address belongs to the
 * active account only, and it stays empty until the wallet has loaded it: the persisted
 * one still names the account until then.
 */
export const selfCustodialAccountName = ({
  isActive,
  liveLightningAddress,
  persistedLightningAddress,
  anonymousName,
}: AccountNameSource): string => {
  const address = isActive
    ? presentAddress(liveLightningAddress) ?? presentAddress(persistedLightningAddress)
    : presentAddress(persistedLightningAddress)
  return address ?? anonymousName
}
