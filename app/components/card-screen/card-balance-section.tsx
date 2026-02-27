import React from "react"
import { TouchableOpacity, View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { Text, makeStyles } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"

type CardBalanceSectionProps = {
  balanceUsd: string
  balanceSecondary: string
  isDisabled: boolean
  onAddFunds: () => void
}

export const CardBalanceSection: React.FC<CardBalanceSectionProps> = ({
  balanceUsd,
  balanceSecondary,
  isDisabled,
  onAddFunds,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  return (
    <View style={styles.container}>
      <View style={styles.balanceColumn}>
        <Text type="p1" bold style={styles.balanceUsd}>
          {balanceUsd}
        </Text>
        <Text type="p4" style={styles.balanceSecondary}>
          {balanceSecondary}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.addFundsButton, isDisabled && styles.addFundsDisabled]}
        onPress={onAddFunds}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <Text type="p3" style={styles.addFundsText}>
          {LL.CardFlow.CardDashboard.addFunds()}
        </Text>
        <Icon name="add" size={18} color={styles.primaryColor.color} />
      </TouchableOpacity>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 12,
  },
  balanceColumn: {
    flexDirection: "column",
  },
  balanceUsd: {
    color: colors.black,
  },
  balanceSecondary: {
    color: colors.grey1,
  },
  addFundsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 40,
    gap: 6,
  },
  addFundsDisabled: {
    opacity: 0.5,
  },
  addFundsText: {
    color: colors.black,
  },
  primaryColor: {
    color: colors.primary,
  },
}))
