import React from "react"
import { View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNwcConnectionsQuery } from "@app/screens/nostr-wallet-connect/hooks"

import { SettingsRow } from "../row"

export const NwcSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { connectionCount } = useNwcConnectionsQuery()

  return (
    <SettingsRow
      title={LL.NostrWalletConnect.connectedApps()}
      leftGaloyIcon="link"
      extraComponentBesideTitle={
        connectionCount > 0 ? <ConnectionCountBadge count={connectionCount} /> : <></>
      }
      action={() => navigate("nwcConnectedApps")}
    />
  )
}

const ConnectionCountBadge: React.FC<{ count: number }> = ({ count }) => {
  const styles = useStyles()

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.white,
  },
}))
