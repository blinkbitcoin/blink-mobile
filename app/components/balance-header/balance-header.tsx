import * as React from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { Pressable, TouchableOpacity, View, Text } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { HiddenBalancePlaceholder } from "@app/components/hidden-balance-placeholder/hidden-balance-placeholder"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { BalanceMode } from "@app/hooks/use-balance-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

/** The 32pt balance sits directly under the fixed-size home header chrome;
 *  uncapped Dynamic Type makes it overrun the username row above. */
const MAX_BALANCE_FONT_SIZE_MULTIPLIER = 1.4

const Loader = () => {
  const styles = useStyles()
  return (
    <ContentLoader
      height={40}
      width={100}
      speed={1.2}
      backgroundColor={styles.loaderBackground.color}
      foregroundColor={styles.loaderForefound.color}
      viewBox="0 0 100 40"
    >
      <Rect x="0" y="0" rx="4" ry="4" width="100" height="40" />
    </ContentLoader>
  )
}

type Props = {
  loading: boolean
  formattedBalance?: string
  showStableBalanceToggle?: boolean
  mode?: BalanceMode
  onModeChange?: () => void
  /** The amount above is priced off an exchange rate old enough that the user should be
   *  told, rather than read it as today's. Never blocks the figure: an old rate is a
   *  caveat on a number, not a reason to withhold it. */
  isRateStale?: boolean
  /** The amount above is in sats because nothing could price it. Said out loud so a
   *  balance that changes denomination does not read as money changing. */
  isSatsOnly?: boolean
}

export const BalanceHeader: React.FC<Props> = ({
  loading,
  formattedBalance,
  showStableBalanceToggle,
  mode,
  onModeChange,
  isRateStale = false,
  isSatsOnly = false,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const { hideAmount, toggleHideAmount } = useHideAmount()
  const currentMode = mode ?? BalanceMode.Btc

  /** One slot, and sats-only wins: "no rate at all" subsumes "the rate is old", and two
   *  lines under a balance is one too many. */
  const noticeText = isSatsOnly
    ? LL.SelfCustodialStaleRate.satsOnly()
    : isRateStale
      ? LL.SelfCustodialStaleRate.notice()
      : null

  const modeLabel =
    currentMode === BalanceMode.Btc
      ? LL.StableBalance.balanceLabelBtc()
      : LL.StableBalance.balanceLabelUsd()

  return (
    <View {...testProps("balance-header")} style={styles.balanceHeaderContainer}>
      {hideAmount ? (
        <TouchableOpacity style={styles.balanceWrapper} onPress={toggleHideAmount}>
          <HiddenBalancePlaceholder size="large" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={toggleHideAmount}>
          <View style={styles.amountWrapper}>
            {loading ? (
              <Loader />
            ) : (
              <Text
                {...testProps("balance-value")}
                style={styles.primaryBalanceText}
                allowFontScaling
                maxFontSizeMultiplier={MAX_BALANCE_FONT_SIZE_MULTIPLIER}
                adjustsFontSizeToFit
              >
                {formattedBalance}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
      {noticeText && !hideAmount && !loading ? (
        <Text style={styles.staleRateText} {...testProps("balance-rate-notice")}>
          {noticeText}
        </Text>
      ) : null}
      {showStableBalanceToggle && onModeChange ? (
        <Pressable
          onPress={onModeChange}
          accessibilityRole="button"
          style={styles.modeToggle}
          {...testProps("balance-mode-toggle")}
        >
          <Text style={styles.modeToggleText}>{modeLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  balanceHeaderContainer: {
    alignItems: "center",
    textAlign: "center",
  },
  balanceWrapper: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  amountWrapper: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
  },
  primaryBalanceText: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.black,
  },
  loaderBackground: {
    color: colors.loaderBackground,
  },
  loaderForefound: {
    color: colors.loaderForeground,
  },
  staleRateText: {
    marginTop: 4,
    fontSize: 12,
    textAlign: "center",
    color: colors.grey2,
  },
  modeToggle: {
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  modeToggleText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.grey2,
    letterSpacing: 0.6,
  },
}))
