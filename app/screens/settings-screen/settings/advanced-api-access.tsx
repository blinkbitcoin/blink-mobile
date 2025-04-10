import React from "react"
import { Linking } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsRow } from "../row"

const DASHBOARD_LINK = "https://dashboard.blink.sv"

export const ApiAccessSetting: React.FC = () => {
  const { LL } = useI18nContext()

  return (
    <SettingsRow
      title={LL.SettingsScreen.apiAcess()}
      subtitle={DASHBOARD_LINK}
      subtitleShorter={true}
      leftIcon="code"
      rightIcon={<GaloyIcon name="link" size={24} />}
      action={() => {
        Linking.openURL(DASHBOARD_LINK)
      }}
    />
  )
}
