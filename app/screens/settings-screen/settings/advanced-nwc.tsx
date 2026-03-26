import React from "react"

import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsRow } from "../row"

export const NwcSetting: React.FC = () => {
  const { LL } = useI18nContext()

  return (
    <SettingsRow
      title={LL.SettingsScreen.nostrWalletConnect()}
      leftGaloyIcon="nostr-wallet-connect"
      action={() => console.log("NWC pressed")}
    />
  )
}
