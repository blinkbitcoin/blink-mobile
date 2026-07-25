import React from "react"
import { Linking } from "react-native"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { QrCodeIcon } from "phosphor-react-native"
import { useI18nContext } from "@app/i18n/i18n-react"
import { getPrintableQrCodeUrl } from "@app/utils/pay-links"

import { SettingsRow } from "../row"
import { usePayLinks } from "./use-pay-links"

export const AccountStaticQR: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { username, loading } = usePayLinks()

  if (!username) return null

  const qrUrl = getPrintableQrCodeUrl(username)

  return (
    <SettingsRow
      loading={loading}
      title={LL.SettingsScreen.staticQr()}
      subtitleShorter={true}
      leftGaloyIcon={<QrCodeIcon size={20} color={colors.black} />}
      rightIcon={<GaloyIcon name="arrow-square-out" size={20} color={colors.primary} />}
      action={() => {
        Linking.openURL(qrUrl)
      }}
    />
  )
}
