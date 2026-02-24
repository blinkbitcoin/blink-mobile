import React, { useReducer, useState } from "react"
import ReactNativeModal from "react-native-modal"
import { Pressable, SafeAreaView, StyleProp, View, ViewStyle } from "react-native"
import { Input, makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  formatNumberPadNumber,
  Key,
  numberPadReducer,
  NumberPadReducerActionType,
  numberPadToString,
  parseStringToNumberPad,
} from "@app/components/amount-input-screen/number-pad-reducer"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CurrencyKeyboard } from "@app/components/currency-keyboard"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { WalletOrDisplayCurrency } from "@app/types/amounts"
import { useI18nContext } from "@app/i18n/i18n-react"

type LimitInputProps = {
  label: string
  value: string
  helperText: string
  onChangeValue: (value: string) => void
  icon?: IconNamesType
  minHeight?: number
  currency?: string
}

export const LimitInput: React.FC<LimitInputProps> = ({
  label,
  value,
  helperText,
  onChangeValue,
  icon = "pencil",
  minHeight = 52,
  currency = "USD",
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { getCurrencySymbol, getFractionDigits, currencyInfo } = useDisplayCurrency()

  const currencySymbol = getCurrencySymbol({ currency })
  const decimalsAllowed = getFractionDigits({ currency })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [numberPadState, dispatch] = useReducer(numberPadReducer, {
    numberPadNumber: parseStringToNumberPad(value),
    numberOfDecimalsAllowed: decimalsAllowed,
    currency: currency as WalletOrDisplayCurrency,
  })

  const handleOpen = () => {
    dispatch({
      action: NumberPadReducerActionType.SetAmount,
      payload: {
        numberPadNumber: parseStringToNumberPad(value),
        numberOfDecimalsAllowed: decimalsAllowed,
        currency: currency as WalletOrDisplayCurrency,
      },
    })
    setIsModalOpen(true)
  }

  const handleKeyPress = (key: Key) => {
    dispatch({
      action: NumberPadReducerActionType.HandleKeyPress,
      payload: { key },
    })
  }

  const handleConfirm = () => {
    const newValue = numberPadToString(numberPadState.numberPadNumber)
    onChangeValue(newValue)
    setIsModalOpen(false)
  }

  const handleClose = () => {
    setIsModalOpen(false)
  }

  const pressableStyle = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => [
    styles.valueCard,
    { minHeight },
    pressed && styles.valueCardPressed,
  ]

  const formattedValue = `${currencySymbol}${(Number(value) || 0).toLocaleString()}`
  const modalDisplayValue = formatNumberPadNumber({
    numberPadNumber: numberPadState.numberPadNumber,
    currency: currency as WalletOrDisplayCurrency,
    currencyInfo,
    noSuffix: true,
  })

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={pressableStyle}
        onPress={handleOpen}
        accessibilityLabel={`${label}: ${formattedValue}`}
        accessibilityRole="button"
      >
        <Text style={styles.value}>{formattedValue}</Text>
        <GaloyIcon name={icon} size={20} color={colors.primary} />
      </Pressable>
      <Text style={styles.helperText}>{helperText}</Text>

      <ReactNativeModal isVisible={isModalOpen} coverScreen={true} style={styles.modal}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text type="h1">{label}</Text>
            <GaloyIconButton iconOnly size="medium" name="close" onPress={handleClose} />
          </View>
          <View style={styles.modalBody}>
            <View style={styles.amountDisplay}>
              <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              <Input
                value={modalDisplayValue}
                showSoftInputOnFocus={false}
                editable={false}
                containerStyle={styles.amountInputContainer}
                inputStyle={styles.amountInputText}
                inputContainerStyle={styles.amountInputInnerContainer}
                renderErrorMessage={false}
              />
              <Text style={styles.currencyCode}>{currency}</Text>
            </View>
            <View style={styles.spacer} />
            <View style={styles.keyboardContainer}>
              <CurrencyKeyboard onPress={handleKeyPress} />
            </View>
            <GaloyPrimaryButton title={LL.common.confirm()} onPress={handleConfirm} />
          </View>
        </SafeAreaView>
      </ReactNativeModal>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: 3,
  },
  label: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  valueCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 14,
  },
  valueCardPressed: {
    opacity: 0.7,
  },
  value: {
    color: colors.black,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  helperText: {
    color: colors.black,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "400",
  },
  modal: {
    backgroundColor: colors.white,
    margin: 0,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomColor: colors.primary4,
    borderBottomWidth: 1,
  },
  modalBody: {
    flex: 1,
    padding: 24,
  },
  amountDisplay: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "bold",
  },
  amountInputContainer: {
    flex: 1,
  },
  amountInputText: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "bold",
  },
  amountInputInnerContainer: {
    borderBottomWidth: 0,
  },
  currencyCode: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "bold",
    textAlign: "right",
  },
  spacer: {
    flex: 1,
  },
  keyboardContainer: {
    marginBottom: 30,
    paddingHorizontal: 16,
  },
}))
