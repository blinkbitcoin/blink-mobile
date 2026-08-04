import React from "react"
import { Linking } from "react-native"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsRow } from "../row"
import { usePayLinks } from "./use-pay-links"

const BTCPAY_PLUGIN_URL = "https://www.blink.sv/en/btcpay-blink-plugin"

export const AccountBtcpay: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { username, loading } = usePayLinks()

  // The plugin page itself takes no username, but it is only actionable once the
  // account has an address to connect, so it follows the rest of the group.
  if (!username) return null

  return (
    <SettingsRow
      loading={loading}
      title={LL.SettingsScreen.btcpayServer()}
      leftGaloyIcon="btcpay"
      rightIcon={<GaloyIcon name="arrow-square-out" size={20} color={colors.primary} />}
      action={() => {
        Linking.openURL(BTCPAY_PLUGIN_URL)
      }}
    />
  )
}
