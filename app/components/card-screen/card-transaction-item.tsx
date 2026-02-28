import React from "react"
import { View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"

type CardTransactionItemProps = {
  merchantName: string
  timeAgo: string
  amount: string
  status: CardTransactionStatus
}

const CARD_TRANSACTION_STATUS = {
  Pending: "pending",
  Completed: "completed",
} as const

type CardTransactionStatus =
  (typeof CARD_TRANSACTION_STATUS)[keyof typeof CARD_TRANSACTION_STATUS]

export const CardTransactionItem: React.FC<CardTransactionItemProps> = ({
  merchantName,
  timeAgo,
  amount,
  status,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const isPending = status === CARD_TRANSACTION_STATUS.Pending
  const statusColor = isPending ? colors.grey2 : colors._green
  const statusText = isPending
    ? LL.CardFlow.TransactionStatus.pending()
    : LL.CardFlow.TransactionStatus.completed()

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="storefront-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.detailsColumn}>
        <Text type="p3" bold numberOfLines={1} style={styles.merchantName}>
          {merchantName}
        </Text>
        <Text type="p4" style={styles.timeAgo}>
          {timeAgo}
        </Text>
      </View>
      <View style={styles.amountColumn}>
        <Text type="p3" bold style={styles.amount}>
          {amount}
        </Text>
        <Text type="p4" style={[styles.status, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 55,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.grey5,
  },
  iconContainer: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  detailsColumn: {
    flex: 1,
    justifyContent: "center",
    marginRight: 12,
  },
  merchantName: {
    color: colors.black,
  },
  timeAgo: {
    color: colors.grey2,
    marginTop: 0,
  },
  amountColumn: {
    alignItems: "flex-end",
  },
  amount: {
    color: colors.black,
  },
  status: {
    marginTop: 0,
  },
}))
