import React, { useEffect, useState } from "react"
import { Pressable, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { usePayments } from "@app/hooks/use-payments"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { DepositStatus } from "@app/types/payment.types"
import { testProps } from "@app/utils/testProps"

export const UnclaimedDepositBanner: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { listPendingDeposits } = usePayments()
  const [count, setCount] = useState(0)
  const [totalSats, setTotalSats] = useState(0)

  useEffect(() => {
    if (!listPendingDeposits) return
    listPendingDeposits().then(({ deposits }) => {
      const active = deposits.filter(({ status }) => status !== DepositStatus.Refunded)
      setCount(active.length)
      setTotalSats(active.reduce((sum, { amount }) => sum + amount.amount, 0))
    })
  }, [listPendingDeposits])

  if (count === 0) return null

  return (
    <Pressable
      style={styles.container}
      onPress={() => navigation.navigate("unclaimedDepositsScreen")}
      {...testProps("unclaimed-deposit-banner")}
    >
      <View style={styles.content}>
        <GaloyIcon name="receive" size={20} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{LL.UnclaimedDeposit.title({ count })}</Text>
          <Text style={styles.description}>
            {LL.UnclaimedDeposit.description({ sats: totalSats })}
          </Text>
        </View>
        <GaloyIcon name="caret-right" size={20} color={colors.primary} />
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    padding: 14,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.black,
  },
  description: {
    fontSize: 12,
    color: colors.grey2,
  },
}))
