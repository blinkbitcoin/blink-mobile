import * as React from "react"
import { View } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { Input, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyErrorBox } from "../atomic/galoy-error-box"
import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
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
  goBack: () => void
  compact?: boolean
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
  goBack,
  compact = false,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles(compact)
  const { theme } = useTheme()

  return (
    <View style={styles.amountInputScreenContainer}>
      <View style={styles.headerContainer}>
        <Text type={"h1"}>{LL.AmountInputScreen.enterAmount()}</Text>
        <GaloyIconButton iconOnly={true} size={"medium"} name="close" onPress={goBack} />
      </View>
      <View style={styles.bodyContainer}>
        <View style={styles.amountContainer}>
          <View style={styles.primaryAmountContainer}>
            {primaryCurrencySymbol && (
              <Text style={styles.primaryCurrencySymbol}>{primaryCurrencySymbol}</Text>
            )}
            <Input
              value={primaryCurrencyFormattedAmount}
              showSoftInputOnFocus={false}
              onChangeText={(e) => {
                // remove commas for ease of calculation later on
                const val = e.replaceAll(",", "")
                // TODO adjust for currencies that use commas instead of decimals

                // test for string input that can be either numerical or float
                if (/^\d*\.?\d*$/.test(val.trim())) {
                  const num = Number(val)
                  onPaste(num)
                }
              }}
              containerStyle={styles.primaryNumberContainer}
              inputStyle={styles.primaryNumberText}
              placeholder="0"
              placeholderTextColor={theme.colors.grey3}
              inputContainerStyle={styles.primaryNumberInputContainer}
              renderErrorMessage={false}
            />
            <Text style={styles.primaryCurrencyCodeText}>{primaryCurrencyCode}</Text>
          </View>
          {Boolean(secondaryCurrencyFormattedAmount) && (
            <>
              <View style={styles.swapContainer}>
                <View style={styles.horizontalLine} />
                <GaloyIconButton
                  size={"large"}
                  name="transfer"
                  onPress={onToggleCurrency}
                />
                <View style={styles.horizontalLine} />
              </View>
              <View style={styles.secondaryAmountContainer}>
                <Text style={styles.secondaryAmountText}>
                  {secondaryCurrencySymbol}
                  {secondaryCurrencyFormattedAmount}
                </Text>
                <Text style={styles.secondaryAmountCurrencyCodeText}>
                  {secondaryCurrencyCode}
                </Text>
              </View>
            </>
          )}
        </View>
        <View style={styles.infoContainer}>
          {errorMessage && <GaloyErrorBox errorMessage={errorMessage} />}
        </View>
        <View style={styles.keyboardContainer}>
          <CurrencyKeyboard onPress={onKeyPress} compact={compact} />
        </View>
        <GaloyPrimaryButton
          disabled={!onSetAmountPress || setAmountDisabled}
          onPress={onSetAmountPress}
          title={LL.AmountInputScreen.setAmount()}
        />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }, compact: boolean) => ({
  amountInputScreenContainer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomColor: colors.primary4,
    borderBottomWidth: 1,
  },
  amountContainer: {
    marginBottom: 16,
  },
  primaryNumberContainer: {
    flex: 1,
  },
  primaryAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryCurrencySymbol: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "bold",
  },
  primaryNumberText: {
    fontSize: 28,
    lineHeight: 32,
    flex: 1,
    fontWeight: "bold",
  },
  primaryNumberInputContainer: {
    borderBottomWidth: 0,
  },
  primaryCurrencyCodeText: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "bold",
    textAlign: "right",
  },
  secondaryAmountContainer: {
    flexDirection: "row",
  },
  secondaryAmountText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "bold",
    flex: 1,
  },
  secondaryAmountCurrencyCodeText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "bold",
  },
  swapContainer: {
    alignItems: "center",
    flexDirection: "row",
    marginVertical: 8,
  },
  horizontalLine: {
    borderBottomColor: colors.primary4,
    borderBottomWidth: 1,
    flex: 1,
  },
  infoContainer: {
    flex: 1,
    justifyContent: "flex-start",
  },
  bodyContainer: {
    flex: 1,
    padding: 24,
  },
  buttonContainer: {},
  keyboardContainer: {
    marginBottom: 30,
    ...(compact
      ? { alignSelf: "stretch", paddingHorizontal: 20 }
      : { paddingHorizontal: 16 }),
  },
}))
