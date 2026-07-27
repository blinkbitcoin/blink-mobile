import React from "react"
import { Linking } from "react-native"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useEffectiveDisplayCurrency } from "@app/hooks/use-effective-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { getPosUrl } from "@app/utils/pay-links"

import { SettingsRow } from "../row"
import { usePayLinks } from "./use-pay-links"

export const AccountPOS: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { username, loading } = usePayLinks()
  // Waiting on the currency keeps the row from opening a link built from the USD
  // fallback the hook returns while the custodial query is still in flight.
  const { displayCurrency, loading: displayCurrencyLoading } =
    useEffectiveDisplayCurrency()

  if (!username) return null

  const pos = getPosUrl(username, displayCurrency)

  return (
    <SettingsRow
      loading={loading || displayCurrencyLoading}
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
