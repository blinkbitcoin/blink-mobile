import React from "react"
import { IconNode } from "@rn-vui/base"
import { Input, makeStyles, Text, useTheme } from "@rn-vui/themed"
import {
  LayoutChangeEvent,
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native"

import { CurrencyPill } from "@app/components/atomic/currency-pill"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { WalletCurrency } from "@app/graphql/generated"
import { APPROXIMATE_PREFIX } from "@app/config"
import { CardCurrency } from "@app/types/amounts"
import type { InputRef } from "@app/types/themed-input"
import { fonts } from "@app/rne-theme/fonts"

export type WalletAmountRowProps = {
  inputRef: React.RefObject<InputRef | null>
  value: string
  placeholder: string
  rightIcon?: IconNode
  selection: { start: number; end: number }
  isLocked: boolean
  onOverlayPress: () => void
  onFocus: () => void
  currency: WalletCurrency | CardCurrency
  /** Set when the row can switch to another balance: the pill shows the switch icon and
   *  a tap on it switches. */
  onPillPress?: () => void
  balancePrimary: string
  balanceSecondary?: string | null
  pillContainerStyle?: StyleProp<ViewStyle>
  pillOnLayout?: (event: LayoutChangeEvent) => void
  pillWrapperStyle?: StyleProp<ViewStyle>
  inputContainerStyle?: StyleProp<ViewStyle>
  containerStyle?: StyleProp<ViewStyle>
}

export const WalletAmountRow: React.FC<WalletAmountRowProps> = ({
  inputRef,
  value,
  placeholder,
  rightIcon,
  selection,
  isLocked,
  onOverlayPress,
  onFocus,
  currency,
  onPillPress,
  balancePrimary,
  balanceSecondary,
  pillContainerStyle,
  pillOnLayout,
  pillWrapperStyle,
  inputContainerStyle,
  containerStyle,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  return (
    <View style={[styles.row, isLocked && styles.disabledOpacity, containerStyle]}>
      <Input
        ref={inputRef}
        value={value}
        onFocus={onFocus}
        onChangeText={() => {}}
        showSoftInputOnFocus={false}
        containerStyle={[
          styles.primaryNumberContainer,
          styles.inputWithOverlay,
          inputContainerStyle,
        ]}
        inputStyle={styles.primaryNumberText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        inputContainerStyle={styles.primaryNumberInputContainer}
        renderErrorMessage={false}
        rightIcon={rightIcon}
        selection={selection}
        pointerEvents="none"
      />
      <View style={styles.rightColumn}>
        <View style={[styles.currencyBubbleText, pillWrapperStyle]}>
          <TouchableOpacity
            style={styles.pillSwitch}
            onPress={onPillPress}
            disabled={!onPillPress}
            accessibilityRole="button"
            testID={`wallet-switch-${currency}`}
          >
            {onPillPress && (
              <GaloyIcon
                name="refresh"
                size={PILL_SWITCH_ICON_SIZE}
                color={colors.textMuted}
              />
            )}
            <CurrencyPill
              currency={currency}
              containerSize="medium"
              containerStyle={pillContainerStyle}
              onLayout={pillOnLayout}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.walletSelectorBalanceContainer}>
          <Text style={styles.primaryBalanceText}>{balancePrimary}</Text>
          {balanceSecondary && (
            <Text style={styles.secondaryBalanceText}>
              {APPROXIMATE_PREFIX} {balanceSecondary}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.inputOverlay}
        activeOpacity={1}
        onPress={onOverlayPress}
      />
    </View>
  )
}

const PILL_SWITCH_ICON_SIZE = 12

const useStyles = makeStyles(({ colors }) => ({
  pillSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 11,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 6,
    paddingBottom: 6,
    position: "relative",
    flexGrow: 1,
  },
  inputWithOverlay: {
    position: "relative",
    flex: 1,
    paddingHorizontal: 0,
    alignSelf: "center",
  },
  inputOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  rightColumn: {
    minWidth: 96,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  currencyBubbleText: {
    display: "flex",
    alignItems: "flex-end",
    alignSelf: "flex-end",
    marginTop: 2,
  },
  walletSelectorBalanceContainer: {
    marginTop: 5,
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  primaryBalanceText: {
    textAlign: "right",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textOnBackground,
  },
  secondaryBalanceText: {
    textAlign: "right",
    fontSize: 10,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  primaryNumberContainer: { flex: 1 },
  primaryNumberText: {
    fontSize: 20,
    lineHeight: 24,
    flex: 1,
    padding: 0,
    margin: 0,
    color: colors.textOnBackground,
    fontFamily: fonts.bold,
  },
  primaryNumberInputContainer: { borderBottomWidth: 0, paddingBottom: 0 },
  disabledOpacity: { opacity: 0.5 },
}))
