import React from "react"
import { IconNode } from "@rn-vui/base"
import { Input, makeStyles, Text, useTheme } from "@rn-vui/themed"
import {
  LayoutChangeEvent,
  StyleProp,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native"

import { CurrencyPill } from "@app/components/atomic/currency-pill"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { APPROXIMATE_PREFIX } from "@app/config"

export type WalletAmountRowProps = {
  inputRef: React.RefObject<TextInput>
  value: string
  placeholder: string
  rightIcon?: IconNode
  selection: { start: number; end: number }
  isLocked: boolean
  onOverlayPress: () => void
  onFocus: () => void
  currency: WalletCurrency
  balancePrimary: string
  balanceSecondary?: string | null
  pillContainerStyle?: StyleProp<ViewStyle>
  pillOnLayout?: (event: LayoutChangeEvent) => void
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
  balancePrimary,
  balanceSecondary,
  pillContainerStyle,
  pillOnLayout,
  containerStyle,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL } = useI18nContext()

  return (
    <View style={[styles.row, isLocked && styles.disabledOpacity, containerStyle]}>
      <Input
        ref={inputRef}
        value={value}
        onFocus={onFocus}
        onChangeText={() => {}}
        showSoftInputOnFocus={false}
        containerStyle={[styles.primaryNumberContainer, styles.inputWithOverlay]}
        inputStyle={styles.primaryNumberText}
        placeholder={placeholder}
        placeholderTextColor={colors.grey2}
        inputContainerStyle={styles.primaryNumberInputContainer}
        renderErrorMessage={false}
        rightIcon={rightIcon}
        selection={selection}
        pointerEvents="none"
      />
      <View style={styles.rightColumn}>
        <View style={styles.currencyBubbleText}>
          <CurrencyPill
            currency={currency}
            textSize="p3"
            containerSize="medium"
            label={
              currency === WalletCurrency.Usd ? LL.common.dollar() : LL.common.bitcoin()
            }
            containerStyle={pillContainerStyle}
            onLayout={pillOnLayout}
          />
        </View>
        <View style={styles.walletSelectorBalanceContainer}>
          <Text style={styles.convertText}>{balancePrimary}</Text>
          {balanceSecondary && (
            <Text style={styles.convertText}>
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

const useStyles = makeStyles(({ colors }) => ({
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
  convertText: { textAlign: "right" },
  primaryNumberContainer: { flex: 1 },
  primaryNumberText: {
    fontSize: 20,
    lineHeight: 24,
    flex: 1,
    padding: 0,
    margin: 0,
    color: colors.grey1,
  },
  primaryNumberInputContainer: { borderBottomWidth: 0, paddingBottom: 0 },
  disabledOpacity: { opacity: 0.5 },
}))
