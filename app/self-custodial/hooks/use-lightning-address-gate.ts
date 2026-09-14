import { useSelfCustodialAccountMode } from "./use-self-custodial-account-mode"

/**
 * Whether the account's Lightning address is withheld as a way to get paid.
 *
 * The address is a public identifier a server answers for, so it only works while the
 * account carries an identity that server knows. Incognito carries none, and an address
 * nothing can pay must not be offered as a way to receive. Every surface that offers or
 * labels the address reads this, so the next reason to withhold it lands here instead of
 * being restated screen by screen.
 */
export const useLightningAddressGated = (): boolean => {
  const { isAnonMode } = useSelfCustodialAccountMode()

  return isAnonMode
}
