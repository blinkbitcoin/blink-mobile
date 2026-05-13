import React from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNwcConnections } from "@app/screens/nostr-wallet-connect/hooks"

import { SettingsRow } from "../row"

export const NwcSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { hasConnections } = useNwcConnections()

  return (
    <SettingsRow
      title={LL.SettingsScreen.nostrWalletConnect()}
      leftGaloyIcon="nostr-wallet-connect"
      action={() => navigate(hasConnections ? "nwcConnectedApps" : "nwcEmptyState")}
    />
  )
}
