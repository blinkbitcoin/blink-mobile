import React, { useMemo } from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { TransactionStatus } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"

type StatusBadgeProps = {
  status: TransactionStatus
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const backgroundColorMap = useMemo<Record<TransactionStatus, string>>(
    () => ({
      [TransactionStatus.Pending]: colors.grey3,
      [TransactionStatus.Completed]: colors.success,
      [TransactionStatus.Declined]: colors.error,
      [TransactionStatus.Reversed]: colors.warning,
    }),
    [colors],
  )

  const statusTextMap = useMemo<Record<TransactionStatus, string>>(
    () => ({
      [TransactionStatus.Pending]: LL.CardFlow.TransactionStatus.pending(),
      [TransactionStatus.Completed]: LL.CardFlow.TransactionStatus.completed(),
      [TransactionStatus.Declined]: LL.CardFlow.TransactionStatus.declined(),
      [TransactionStatus.Reversed]: LL.CardFlow.TransactionStatus.reversed(),
    }),
    [LL],
  )

  const backgroundColor = backgroundColorMap[status] ?? colors.grey3
  const statusText = statusTextMap[status] ?? status

  const styles = useStyles({ backgroundColor })

  return (
    <View style={styles.badge}>
      <Text style={[styles.text, { color: colors.black }]}>{statusText}</Text>
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
