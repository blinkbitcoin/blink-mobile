import React, { useMemo } from "react"
import { Pressable, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { usePendingDeposits } from "@app/self-custodial/hooks"
import { DepositStatus } from "@app/types/payment"
import { testProps } from "@app/utils/testProps"

import { GaloyIcon } from "../atomic/galoy-icon"

export const UnclaimedDepositBanner: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { deposits } = usePendingDeposits()

  const { count, totalSats } = useMemo(() => {
    const active = deposits.filter(({ status }) => status !== DepositStatus.Refunded)
    return {
      count: active.length,
      totalSats: active.reduce((sum, { amount }) => sum + amount.amount, 0),
    }
  }, [deposits])

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
