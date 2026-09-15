import React, { useEffect, useRef } from "react"
import { Animated, Easing, Pressable } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { WalletSwitch } from "@app/components/wallet-switch"
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
  /** Outlines the card in the error colour when the amount can't be sent from this wallet. */
  hasError?: boolean
  /** Absent when there is no other wallet to switch to (the region withholds the dollar
   *  wallet), which leaves the summary as a plain read-out. */
  onSwitch?: () => void
}

export const SendWalletSummary: React.FC<SendWalletSummaryProps> = ({
  currency,
  balancePrimary,
  balanceSecondary,
  hasError = false,
  onSwitch,
}) => {
  const styles = useStyles()
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

  const balancesAnimatedStyle = {
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
      style={({ pressed }) => [
        styles.card,
        hasError && styles.cardError,
        pressed && onSwitch && styles.cardPressed,
      ]}
      onPress={onSwitch}
      disabled={!onSwitch}
      accessibilityRole={onSwitch ? "button" : undefined}
      accessibilityLabel={`${walletName}, ${balancePrimary}`}
    >
      <Animated.View style={[styles.balances, balancesAnimatedStyle]}>
        <Text style={styles.balancePrimary} {...testProps(`${currency} Wallet Balance`)}>
          {balancePrimary}
        </Text>
        {balanceSecondary ? (
          <Text style={styles.balanceSecondary}>{balanceSecondary}</Text>
        ) : null}
      </Animated.View>
      <WalletSwitch currency={currency} canToggle={Boolean(onSwitch)} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  /** Matches the receive screen's amount row, so the card is the same height whether or not
   *  the wallet has a second denomination to show. */
  card: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 20,
    minHeight: 67,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.transparent,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardError: {
    borderColor: colors.error,
  },
  cardPressed: {
    backgroundColor: colors.grey6,
  },
  balances: {
    flex: 1,
    justifyContent: "center",
  },
  balancePrimary: {
    fontFamily: "SourceSansPro-Bold",
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
  },
  balanceSecondary: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.black,
  },
}))
