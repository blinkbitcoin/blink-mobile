import React from "react"
import { Linking } from "react-native"

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
      leftGaloyIcon="document-outline"
      action={() => {
        Linking.openURL(DASHBOARD_LINK)
      }}
    />
  )
}
