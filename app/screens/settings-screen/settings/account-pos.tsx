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
  /**
   * Only the currency is read here; the setter the hook also returns belongs to the
   * display currency screen. Its query is cache-only until the account is authed, so
   * this row adds no request for a logged-out user even though it does not skip.
   *
   * Waiting on it keeps the row from opening a link built from the USD the hook
   * answers with while the custodial query is still in flight. The cost is that a
   * merchant whose cache is cold and whose network is hanging sees the row as a
   * skeleton for as long as the query does not settle; opening someone's cash
   * register in the wrong currency is the worse of the two.
   */
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
