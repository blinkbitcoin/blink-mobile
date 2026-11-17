import React from "react"
import { Linking } from "react-native"

import { TELEGRAM_COMMUNITY_URL } from "@app/components/contact-modal/contact-modal"
import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsRow } from "../row"

export const JoinCommunitySetting: React.FC = () => {
  const { LL } = useI18nContext()

  return (
    <SettingsRow
      title={LL.support.joinTheCommunity()}
      leftGaloyIcon="people"
      action={() => Linking.openURL(TELEGRAM_COMMUNITY_URL)}
    />
  )
}
