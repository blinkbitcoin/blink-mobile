import React from "react"
import { View, TouchableOpacity, TextInput, StyleProp, ViewStyle } from "react-native"
import { Input, Text, makeStyles, useTheme } from "@rn-vui/themed"
import { IconNode } from "@rn-vui/base"

import { WalletCurrency } from "@app/graphql/generated"
import { GaloyCurrencyBubbleText } from "@app/components/atomic/galoy-currency-bubble-text"

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
      <TouchableOpacity
        style={styles.inputOverlay}
        activeOpacity={1}
        onPress={onOverlayPress}
      />
      <View style={styles.rightColumn}>
        <View style={styles.currencyBubbleText}>
          <GaloyCurrencyBubbleText
            currency={currency}
            textSize="p2"
            containerSize="medium"
          />
        </View>
        <View style={styles.walletSelectorBalanceContainer}>
          <Text style={styles.convertText}>{balancePrimary}</Text>
          <Text style={styles.convertText}>
            {balanceSecondary ? `~ ${balanceSecondary}` : ""}
          </Text>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 6,
    position: "relative",
  },
  inputWithOverlay: {
    position: "relative",
    flex: 1,
    paddingHorizontal: 0,
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
    justifyContent: "flex-end",
  },
  convertText: { textAlign: "right" },
  primaryNumberContainer: { flex: 1 },
  primaryNumberText: {
    fontSize: 20,
    lineHeight: 24,
    flex: 1,
    padding: 0,
    margin: 0,
  },
  primaryNumberInputContainer: { borderBottomWidth: 0, paddingBottom: 0 },
  disabledOpacity: { opacity: 0.5 },
}))
