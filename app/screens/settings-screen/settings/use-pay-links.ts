import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"
import { extractLightningAddressUsername } from "@app/utils/pay-links"

import { useSelfCustodialLightningAddress } from "./use-self-custodial-lightning-address"

// Self-custodial pay links point at the standalone terminal rather than the
// custodial pay-server, so the host is not read from the galoy instance config.
const SELF_CUSTODIAL_TERMINAL_URL = "https://terminal.blinkbtc.com"

type PayLinks = {
  /** Null until the account has a username, which hides the dependent rows. */
  username: string | null
  /** Host the POS and printable-QR links are built on. */
  baseUrl: string
  loading: boolean
}

/**
 * Resolves the identity the merchant pay links (POS, printable QR, donation
 * button) are built from.
 *
 * Custodial accounts key off the account username; self-custodial accounts have
 * no username of their own, so they key off the username portion of their
 * lightning address and stay hidden until one is registered.
 */
export const usePayLinks = (): PayLinks => {
  const { appConfig } = useAppConfig()
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()

  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed })
  const selfCustodialAddress = useSelfCustodialLightningAddress()

  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  return {
    username: isSelfCustodial
      ? extractLightningAddressUsername(selfCustodialAddress)
      : data?.me?.username ?? null,
    baseUrl: isSelfCustodial
      ? SELF_CUSTODIAL_TERMINAL_URL
      : appConfig.galoyInstance.posUrl,
    // The self-custodial address resolves synchronously; only the custodial
    // username arrives over the network, so only it can show a skeleton.
    loading: !isSelfCustodial && loading,
  }
}
