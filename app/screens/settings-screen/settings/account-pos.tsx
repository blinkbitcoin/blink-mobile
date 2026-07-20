import React from "react"
import { Linking } from "react-native"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { AccountType } from "@app/types/wallet"
import { extractLightningAddressUsername, getPosUrl } from "@app/utils/pay-links"

import { SettingsRow } from "../row"
import { useSelfCustodialLightningAddress } from "./use-self-custodial-lightning-address"

// Self-custodial POS points at the standalone terminal rather than the custodial
// pay-server, so it is not read from the galoy instance config.
const SELF_CUSTODIAL_TERMINAL_URL = "https://terminal.blinkbtc.com"

export const AccountPOS: React.FC = () => {
  const { appConfig } = useAppConfig()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()

  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed })
  const selfCustodialAddress = useSelfCustodialLightningAddress()

  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  // Custodial POS keys off the account username; self-custodial keys off the
  // username portion of the lightning address (hidden until an address exists).
  const username = isSelfCustodial
    ? extractLightningAddressUsername(selfCustodialAddress)
    : data?.me?.username ?? null

  if (!username) return null

  const pos = getPosUrl(
    isSelfCustodial ? SELF_CUSTODIAL_TERMINAL_URL : appConfig.galoyInstance.posUrl,
    username,
  )

  return (
    <SettingsRow
      loading={!isSelfCustodial && loading}
      title={LL.SettingsScreen.pos()}
      subtitleShorter={username.length > 22}
      leftGaloyIcon="calculator"
      rightIcon={<GaloyIcon name="arrow-square-out" size={20} color={colors.primary} />}
      action={() => {
        Linking.openURL(pos)
      }}
    />
  )
}
