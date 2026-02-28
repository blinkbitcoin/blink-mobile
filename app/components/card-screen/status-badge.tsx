import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"

const STATUS_TYPES = {
  Pending: "pending",
  Completed: "completed",
} as const

type StatusType = (typeof STATUS_TYPES)[keyof typeof STATUS_TYPES]

type StatusBadgeProps = {
  status: StatusType
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const isPending = status === STATUS_TYPES.Pending

  const backgroundColor = isPending ? colors.warning : colors.success
  const textColor = colors.black

  const statusText = isPending
    ? LL.CardFlow.TransactionStatus.pending()
    : LL.CardFlow.TransactionStatus.completed()

  const styles = useStyles({ backgroundColor })

  return (
    <View style={styles.badge}>
      <Text style={[styles.text, { color: textColor }]}>{statusText}</Text>
    </View>
  )
}

type StyleProps = {
  backgroundColor: string
}

const useStyles = makeStyles((_theme, { backgroundColor }: StyleProps) => ({
  badge: {
    backgroundColor,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 10,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 13,
  },
}))
