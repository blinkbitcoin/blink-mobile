import React from "react"
import Clipboard from "@react-native-clipboard/clipboard"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useLoginMethods } from "@app/screens/settings-screen/account/login-methods-hook"
import { useAppConfig } from "@app/hooks"
import { toastShow } from "@app/utils/toast"

import { SettingsRow } from "../row"

export const PhoneLnAddress: React.FC = () => {
  const { appConfig } = useAppConfig()
  const {
    theme: { colors },
  } = useTheme()
  const hostName = appConfig.galoyInstance.lnAddressHostname

  const { loading, phone, phoneVerified } = useLoginMethods()
  const { LL } = useI18nContext()

  if (!phoneVerified || !phone) return null

  const lnAddress = `${phone}@${hostName}`

  return (
    <SettingsRow
      loading={loading}
      title={lnAddress}
      leftIcon="call-outline"
      rightIcon={<GaloyIcon name="copy-paste" size={24} color={colors.primary} />}
      action={() => {
        Clipboard.setString(lnAddress)
        toastShow({
          type: "success",
          message: (translations) =>
            translations.GaloyAddressScreen.copiedLightningAddressToClipboard(),
          LL,
        })
      }}
    />
  )
}
