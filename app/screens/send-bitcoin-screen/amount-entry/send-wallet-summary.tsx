import React, { useEffect, useRef } from "react"
import { Animated, Easing, Pressable, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { CurrencyPill } from "@app/components/atomic/currency-pill"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

export const SEND_WALLET_SUMMARY_TEST_ID = "choose-wallet-to-send-from"

const SWITCH_ANIMATION_MS = 180
const SWITCH_OFFSET = 8

type SendWalletSummaryProps = {
  currency: WalletCurrency
  balancePrimary: string
  balanceSecondary?: string
  /** Absent when there is no other wallet to switch to (the region withholds the dollar
   *  wallet), which leaves the summary as a plain read-out. */
  onSwitch?: () => void
}

export const SendWalletSummary: React.FC<SendWalletSummaryProps> = ({
  currency,
  balancePrimary,
  balanceSecondary,
  onSwitch,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const progress = useRef(new Animated.Value(1)).current
  const previousCurrency = useRef(currency)

  useEffect(() => {
    if (previousCurrency.current === currency) return
    previousCurrency.current = currency
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: SWITCH_ANIMATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [currency, progress])

  const animatedStyle = {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [SWITCH_OFFSET, 0],
        }),
      },
    ],
  }

  const walletName =
    currency === WalletCurrency.Btc ? LL.common.bitcoin() : LL.common.dollar()

  return (
    <Pressable
      {...testProps(SEND_WALLET_SUMMARY_TEST_ID)}
      style={({ pressed }) => [styles.card, pressed && onSwitch && styles.cardPressed]}
      onPress={onSwitch}
      disabled={!onSwitch}
      accessibilityRole={onSwitch ? "button" : undefined}
      accessibilityLabel={`${walletName}, ${balancePrimary}`}
    >
      <Animated.View style={[styles.balances, animatedStyle]}>
        <Text
          type="p2"
          bold
          style={styles.balancePrimary}
          {...testProps(`${currency} Wallet Balance`)}
        >
          {balancePrimary}
        </Text>
        {balanceSecondary ? (
          <Text type="p4" color={colors.grey2}>
            {balanceSecondary}
          </Text>
        ) : null}
      </Animated.View>
      <View style={styles.trailing}>
        {onSwitch ? <GaloyIcon name="refresh" size={16} color={colors.grey2} /> : null}
        <Animated.View style={animatedStyle}>
          <CurrencyPill currency={currency} containerSize="medium" />
        </Animated.View>
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardPressed: {
    backgroundColor: colors.grey4,
  },
  balances: {
    flex: 1,
    flexShrink: 1,
  },
  balancePrimary: {
    flexShrink: 1,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
}))
