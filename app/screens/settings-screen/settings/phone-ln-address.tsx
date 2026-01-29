import React from "react"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useAppConfig } from "@app/hooks"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useLoginMethods } from "@app/screens/settings-screen/account/login-methods-hook"

import { SettingsRow } from "../row"

export const PhoneLnAddress: React.FC = () => {
  const { appConfig } = useAppConfig()
  const {
    theme: { colors },
  } = useTheme()
  const hostName = appConfig.galoyInstance.lnAddressHostname

  const { loading, phone, phoneVerified } = useLoginMethods()
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()

  if (!phoneVerified || !phone) return null

  const lnAddress = `${phone}@${hostName}`

  return (
    <SettingsRow
      loading={loading}
      title={lnAddress}
      leftIcon="call-outline"
      rightIcon={<GaloyIcon name="copy-paste" size={20} color={colors.primary} />}
      action={() =>
        copyToClipboard({
          content: lnAddress,
          message: LL.GaloyAddressScreen.copiedLightningAddressToClipboard(),
        })
      }
    />
  )
}
