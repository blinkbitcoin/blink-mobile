import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"
import { extractLightningAddressUsername } from "@app/utils/pay-links"

import { useSelfCustodialLightningAddress } from "./use-self-custodial-lightning-address"

type PayLinks = {
  /** Null until the account has a username, which hides the dependent rows. */
  username: string | null
  loading: boolean
}

/**
 * Resolves the identity the merchant pay links (POS, printable QR, donation
 * button) are built from.
 *
 * Custodial accounts key off the account username; self-custodial accounts have
 * no username of their own, so they key off the username portion of their
 * lightning address and stay hidden until one is registered. Both modes build
 * the same hosts from it — see pay-links.
 */
export const usePayLinks = (): PayLinks => {
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()

  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed })
  const selfCustodialAddress = useSelfCustodialLightningAddress()

  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  return {
    username: isSelfCustodial
      ? extractLightningAddressUsername(selfCustodialAddress)
      : data?.me?.username ?? null,
    // The self-custodial address resolves synchronously; only the custodial
    // username arrives over the network, so only it can show a skeleton.
    loading: !isSelfCustodial && loading,
  }
}
