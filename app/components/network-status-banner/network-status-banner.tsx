import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ActiveWalletStatus } from "@app/types/wallet"
import { testProps } from "@app/utils/testProps"

export const NetworkStatusBanner: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { status } = useActiveWallet()

  if (status !== ActiveWalletStatus.Degraded) return null

  return (
    <View style={styles.container} {...testProps("network-status-banner-degraded")}>
      <GaloyIcon name="warning" size={16} color={colors.warning} />
      <Text style={styles.text}>{LL.NetworkStatus.degradedBanner()}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.grey5,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey4,
  },
  text: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
}))
