import React from "react"
import { TouchableOpacity, View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { CardTransactionUiStatus } from "./types"

type CardTransactionItemProps = {
  merchantName: string
  timeAgo: string
  amount: string
  status: CardTransactionUiStatus
  onPress?: () => void
}

export const CardTransactionItem: React.FC<CardTransactionItemProps> = ({
  merchantName,
  timeAgo,
  amount,
  status,
  onPress,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const statusConfig = {
    [CardTransactionUiStatus.Pending]: {
      color: colors.grey2,
      text: LL.CardFlow.TransactionStatus.pending(),
    },
    [CardTransactionUiStatus.Completed]: {
      color: colors._green,
      text: LL.CardFlow.TransactionStatus.completed(),
    },
    [CardTransactionUiStatus.Declined]: {
      color: colors.error,
      text: LL.CardFlow.TransactionStatus.declined(),
    },
    [CardTransactionUiStatus.Reversed]: {
      color: colors._orange,
      text: LL.CardFlow.TransactionStatus.reversed(),
    },
  }
  const { color: statusColor, text: statusText } = statusConfig[status]

  const content = (
    <>
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
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${merchantName}, ${amount}, ${statusText}`}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return <View style={styles.container}>{content}</View>
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
