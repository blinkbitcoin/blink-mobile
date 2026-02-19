import * as React from "react"
import { Pressable, StyleSheet, TextInput, View } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../atomic/galoy-icon/galoy-icon"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
import { CurrencyPill } from "../atomic/currency-pill/currency-pill"
import { CurrencyKeyboard } from "../currency-keyboard"
import { Key } from "./number-pad-reducer"

export type AmountInputScreenUIProps = {
  primaryCurrencySymbol?: string
  primaryCurrencyFormattedAmount?: string
  primaryCurrencyCode: string
  secondaryCurrencySymbol?: string
  secondaryCurrencyFormattedAmount?: string
  secondaryCurrencyCode?: string
  errorMessage?: string
  setAmountDisabled?: boolean
  onKeyPress: (key: Key) => void
  onPaste: (keys: number) => void
  onToggleCurrency?: () => void
  onClearAmount: () => void
  onSetAmountPress?: () => void
  disabledKeys?: ReadonlySet<Key>
}

export const AmountInputScreenUI: React.FC<AmountInputScreenUIProps> = ({
  primaryCurrencySymbol,
  primaryCurrencyFormattedAmount,
  primaryCurrencyCode,
  secondaryCurrencySymbol,
  secondaryCurrencyFormattedAmount,
  secondaryCurrencyCode,
  errorMessage,
  onKeyPress,
  onPaste,
  onToggleCurrency,
  onSetAmountPress,
  setAmountDisabled,
  disabledKeys,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const { theme } = useTheme()

  const hasSecondary = Boolean(secondaryCurrencyFormattedAmount)
  const hasError = Boolean(errorMessage)

  return (
    <View style={styles.sheet}>
      <View
        style={[styles.currencyInputGroup, hasError && styles.currencyInputGroupError]}
      >
        <View
          style={[
            styles.inputRow,
            styles.primaryRowBg,
            hasSecondary ? styles.topRow : styles.singleRow,
          ]}
        >
          <CurrencyPill label={primaryCurrencyCode} variant="outlined" />
          <View style={styles.amountContainer}>
            <Text style={styles.amountText}>
              {primaryCurrencySymbol || ""}
              {primaryCurrencyFormattedAmount || "0"}
            </Text>
            <TextInput
              value=""
              showSoftInputOnFocus={false}
              onChangeText={(e) => {
                const val = e.replace(/[^0-9.,]/g, "").replaceAll(",", "")
                if (/^\d*\.?\d*$/.test(val.trim())) {
                  const num = Number(val)
                  onPaste(num)
                }
              }}
              style={styles.hiddenInput}
              caretHidden
            />
          </View>
        </View>

        {hasSecondary && (
          <>
            <View style={[styles.inputRow, styles.bottomRow]}>
              <CurrencyPill label={secondaryCurrencyCode} variant="outlined" />
              <View style={styles.amountContainer}>
                <Text style={styles.amountText}>
                  {secondaryCurrencySymbol}
                  {secondaryCurrencyFormattedAmount}
                </Text>
              </View>
            </View>
            <View style={styles.toggleOverlay} pointerEvents="box-none">
              <Pressable
                onPress={onToggleCurrency}
                style={({ pressed }) => [
                  styles.toggleButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <GaloyIcon name="transfer" size={34} color={theme.colors.primary} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      <View>
        <View style={styles.errorRow}>
          <GaloyIcon
            name="warning"
            size={14}
            color={hasError ? theme.colors.error : "transparent"}
          />
          <Text type="p3" color={hasError ? theme.colors.error : "transparent"}>
            {errorMessage || " "}
          </Text>
        </View>
        <View style={styles.keyboardContainer}>
          <CurrencyKeyboard onPress={onKeyPress} disabledKeys={disabledKeys} />
        </View>
      </View>

      <View style={styles.ctaSection}>
        <GaloyPrimaryButton
          disabled={!onSetAmountPress || setAmountDisabled}
          onPress={onSetAmountPress}
          title={LL.AmountInputScreen.setAmount()}
        />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  sheet: {
    paddingTop: 6,
    paddingHorizontal: 20,
    gap: 14,
  },
  currencyInputGroup: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  currencyInputGroupError: {
    borderColor: colors.error,
  },
  inputRow: {
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primaryRowBg: {
    backgroundColor: colors.grey6,
  },
  singleRow: {
    borderRadius: 12,
    paddingVertical: 15,
  },
  topRow: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 15,
    paddingBottom: 27,
  },
  bottomRow: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingTop: 27,
    paddingBottom: 15,
  },
  toggleOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.grey4,
    justifyContent: "center",
    alignItems: "center",
  },
  amountContainer: {
    flex: 1,
    minWidth: 100,
  },
  amountText: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "right",
    color: colors.black,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  keyboardContainer: {
    paddingTop: 14,
    paddingBottom: 14,
  },
  ctaSection: {
    paddingTop: 10,
    paddingBottom: 20,
  },
}))
