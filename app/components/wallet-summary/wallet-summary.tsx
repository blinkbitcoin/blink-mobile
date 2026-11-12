import React, { useEffect } from "react"
import { Pressable, View } from "react-native"
import ContentLoader, { Rect } from "react-content-loader/native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { makeStyles, Text } from "@rn-vui/themed"

import { HiddenBalancePlaceholder } from "@app/components/hidden-balance-placeholder/hidden-balance-placeholder"
import { WalletSwitch, type WalletSwitchValue } from "@app/components/wallet-switch"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

export const SEND_WALLET_SUMMARY_TEST_ID = "choose-wallet-to-send-from"
export const SEND_WALLET_SECONDARY_TEST_ID = "send-wallet-balance-secondary"
export const SEND_WALLET_SIZER_TEST_ID = "send-wallet-balance-sizer"
export const SEND_WALLET_LINES_TEST_ID = "send-wallet-balance-lines"
export const WALLET_SUMMARY_LOADER_TEST_ID = "wallet-summary-balance-loader"

const SWITCH_ANIMATION_MS = 180
const SWITCH_OFFSET = 8
const LOADER_WIDTH = 100
const LOADER_HEIGHT = 18

export type WalletSummaryProps = {
  /** "ALL" only where a screen lists both wallets at once (transaction history). */
  currency: WalletSwitchValue
  balancePrimary: string
  balanceSecondary?: string
  /** Outlines the card in the error colour when the amount can't be sent from this wallet. */
  hasError?: boolean
  /** Absent when there is no other wallet to switch to (the region withholds the dollar
   *  wallet), which leaves the summary as a plain read-out on the active surface. */
  onSwitch?: () => void
  /** The wallet a tap selects. A screen reader hears "Switch to" it instead of the card's
   *  balance. */
  switchTo?: WalletSwitchValue
  /** A settled read-out rather than a control: the static grey7 surface, and no swap icon
   *  at all (rather than the reserved space an unavailable switch keeps). */
  inactive?: boolean
  /** Swaps the balances for the hidden-balance dots, keeping the card's height. */
  balanceHidden?: boolean
  /** Swaps the balances for a loading bar while an amount the card needs is still missing. */
  balanceLoading?: boolean
}

/**
 * The wallet card: balance on the left, the wallet pill (and swap icon) on the right. The
 * transaction details show it as a read-out; the transaction history also gives it "All".
 */
export const WalletSummary: React.FC<WalletSummaryProps> = ({
  currency,
  balancePrimary,
  balanceSecondary,
  hasError = false,
  onSwitch,
  switchTo,
  inactive = false,
  balanceHidden = false,
  balanceLoading = false,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const progress = useSharedValue(1)
  const previousCurrency = useSharedValue(currency)

  useEffect(() => {
    if (previousCurrency.value === currency) return
    previousCurrency.value = currency
    progress.value = 0
    progress.value = withTiming(1, {
      duration: SWITCH_ANIMATION_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [currency, progress, previousCurrency])

  const balancesAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: progress.value,
      transform: [{ translateY: SWITCH_OFFSET * (1 - progress.value) }],
    }),
    [progress],
  )

  const walletNameOf = (value: WalletSwitchValue) =>
    value === WalletCurrency.Btc
      ? LL.common.bitcoin()
      : value === WalletCurrency.Usd
        ? LL.common.dollar()
        : LL.common.allAccounts()

  // Read by the wallet, never the balance: a switch says what a tap selects.
  const accessibilityLabel =
    onSwitch && switchTo
      ? LL.Accessibility.switchToWallet({ wallet: walletNameOf(switchTo) })
      : walletNameOf(currency)

  return (
    <Pressable
      {...testProps(SEND_WALLET_SUMMARY_TEST_ID)}
      style={({ pressed }) => [
        styles.card,
        inactive && styles.cardInactive,
        hasError && styles.cardError,
        pressed && onSwitch && styles.cardPressed,
      ]}
      onPress={onSwitch}
      disabled={!onSwitch}
      accessibilityRole={onSwitch ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.balances}>
        {/* An invisible two-line copy sets the height, so the card is the same size with or
            without a second denomination and still grows with the system text size. */}
        <View
          style={styles.sizer}
          testID={SEND_WALLET_SIZER_TEST_ID}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.balancePrimary}>{balancePrimary || " "}</Text>
          <Text style={styles.balanceSecondary}> </Text>
        </View>
        {/* The visible lines sit over it, centred: a dollar wallet shown in USD is one line. */}
        {balanceHidden ? (
          <View style={styles.balancesVisible}>
            <HiddenBalancePlaceholder size="small" />
          </View>
        ) : balanceLoading ? (
          <View style={styles.balancesVisible} testID={WALLET_SUMMARY_LOADER_TEST_ID}>
            <ContentLoader
              height={LOADER_HEIGHT}
              width={LOADER_WIDTH}
              speed={1.2}
              backgroundColor={styles.loaderBackground.color}
              foregroundColor={styles.loaderForeground.color}
              viewBox={`0 0 ${LOADER_WIDTH} ${LOADER_HEIGHT}`}
            >
              <Rect
                x="0"
                y="0"
                rx="4"
                ry="4"
                width={LOADER_WIDTH}
                height={LOADER_HEIGHT}
              />
            </ContentLoader>
          </View>
        ) : (
          <Animated.View
            style={[styles.balancesVisible, balancesAnimatedStyle]}
            testID={SEND_WALLET_LINES_TEST_ID}
          >
            <Text
              style={styles.balancePrimary}
              {...testProps(`${currency} Wallet Balance`)}
            >
              {balancePrimary}
            </Text>
            {balanceSecondary ? (
              <Text
                style={styles.balanceSecondary}
                {...testProps(SEND_WALLET_SECONDARY_TEST_ID)}
              >
                {balanceSecondary}
              </Text>
            ) : null}
          </Animated.View>
        )}
      </View>
      <WalletSwitch
        currency={currency}
        canToggle={Boolean(onSwitch)}
        hasSwapIcon={!inactive}
      />
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
  loaderBackground: {
    color: colors.loaderBackground,
  },
  loaderForeground: {
    color: colors.loaderForeground,
  },
  cardInactive: {
    backgroundColor: colors.grey7,
  },
  cardError: {
    borderColor: colors.error,
  },
  cardPressed: {
    backgroundColor: colors.grey6,
  },
  balances: {
    flex: 1,
  },
  sizer: {
    opacity: 0,
  },
  balancesVisible: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
  },
  balancePrimary: {
    fontFamily: "SourceSansPro-Bold",
    fontSize: 16,
    lineHeight: 22,
    color: colors.textOnBackground,
  },
  balanceSecondary: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textOnBackground,
  },
}))
