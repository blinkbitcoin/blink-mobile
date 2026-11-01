import { extractLightningAddressUsername } from "@app/utils/pay-links"

type AccountNameSource = {
  isActive: boolean
  liveLightningAddress: string | null | undefined
  persistedLightningAddress: string | null | undefined
  anonymousName: string
}

/**
 * The name a self-custodial account goes by in the account list, on the removal lock and
 * in the toast that says which account went. Every place derives it here, so the same
 * account can't be named one way in Switch account and another in the Danger zone.
 *
 * The live address belongs to the active account only, and it stays empty until the
 * wallet has loaded it: the persisted one still names the account until then.
 */
export const selfCustodialAccountName = ({
  isActive,
  liveLightningAddress,
  persistedLightningAddress,
  anonymousName,
}: AccountNameSource): string =>
  extractLightningAddressUsername(
    isActive
      ? liveLightningAddress ?? persistedLightningAddress
      : persistedLightningAddress,
  ) ?? anonymousName
