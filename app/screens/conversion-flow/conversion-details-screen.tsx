import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { TouchableOpacity, View, ActivityIndicator, TextInput } from "react-native"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import {
  useConversionScreenQuery,
  useRealtimePriceQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  IInputValues,
  InputField,
  useConvertMoneyDetails,
} from "@app/screens/conversion-flow/use-convert-money-details"
import {
  DisplayCurrency,
  lessThan,
  MoneyAmount,
  toBtcMoneyAmount,
  toDisplayAmount,
  toUsdMoneyAmount,
  toWalletAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"
import { NavigationProp, useNavigation } from "@react-navigation/native"
import { Input, makeStyles, Text, useTheme } from "@rneui/themed"
import Icon from "react-native-vector-icons/Ionicons"
import { GaloyCurrencyBubbleText } from "@app/components/atomic/galoy-currency-bubble-text"
import { CurrencyInputModal } from "@app/components/currency-input-modal"
import { AmountInputScreen } from "@app/components/transfer-amount-input"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"

gql`
  query conversionScreen {
    me {
      id
      defaultAccount {
        id
        wallets {
          id
          balance
          walletCurrency
        }
      }
    }
  }
`

enum InputFieldType {
  FROM_INPUT = "fromInput",
  TO_INPUT = "toInput",
  CURRENCY_INPUT = "currencyInput",
}

export const ConversionDetailsScreen = () => {
  const {
    theme: { colors },
  } = useTheme()

  const navigation =
    useNavigation<NavigationProp<RootStackParamList, "conversionDetails">>()

  useRealtimePriceQuery({ fetchPolicy: "network-only" })

  const { data } = useConversionScreenQuery({
    fetchPolicy: "cache-and-network",
    returnPartialData: true,
  })

  const { LL } = useI18nContext()
  const {
    formatMoneyAmount,
    moneyAmountToDisplayCurrencyString,
    getCurrencySymbol,
    displayCurrency,
  } = useDisplayCurrency()
  const styles = useStyles(displayCurrency !== WalletCurrency.Usd)

  const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
  const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

  const {
    fromWallet,
    toWallet,
    setWallets,
    settlementSendAmount,
    setMoneyAmount,
    convertMoneyAmount,
    isValidAmount,
    moneyAmount,
    canToggleWallet,
    toggleWallet,
  } = useConvertMoneyDetails(
    btcWallet && usdWallet
      ? { initialFromWallet: btcWallet, initialToWallet: usdWallet }
      : undefined,
  )

  const [focusedInputValues, setFocusedInputValues] = useState<InputField | null>(null)
  const [initialAmount, setInitialAmount] =
    useState<MoneyAmount<WalletOrDisplayCurrency>>()
  const [inputFormattedValues, setInputFormattedValues] = useState<IInputValues | null>(
    null,
  )
  const [inputValues, setInputValues] = useState<IInputValues>({
    fromInput: {
      id: InputFieldType.FROM_INPUT,
      currency: WalletCurrency.Btc,
      amount: toBtcMoneyAmount(0),
      isFocused: false,
      formattedAmount: "",
    },
    toInput: {
      id: InputFieldType.TO_INPUT,
      currency: WalletCurrency.Usd,
      amount: toUsdMoneyAmount(0),
      isFocused: false,
      formattedAmount: "",
    },
    currencyInput: {
      id: InputFieldType.CURRENCY_INPUT,
      currency: displayCurrency as DisplayCurrency,
      amount: toDisplayAmount({ amount: 0, currencyCode: displayCurrency }),
      isFocused: false,
      formattedAmount: "",
    },
    formattedAmount: "",
  })

  const [isTyping, setIsTyping] = useState(false)
  const [typingInputId, setTypingInputId] = useState<InputField["id"] | null>(null)
  const [uiLocked, setUiLocked] = useState(false)
  const [overlaysReady, setOverlaysReady] = useState(false)

  const fromInputRef = useRef<TextInput | null>(null)
  const toInputRef = useRef<TextInput | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setOverlaysReady(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!fromWallet && btcWallet && usdWallet) {
      setWallets({ fromWallet: btcWallet, toWallet: usdWallet })
    }
  }, [btcWallet, usdWallet, fromWallet, setWallets])

  const handleSetMoneyAmount = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>) => setMoneyAmount(amount),
    [setMoneyAmount],
  )

  useEffect(() => {
    if (fromWallet && toWallet) {
      setInputValues((prev) => ({
        ...prev,
        fromInput: {
          ...prev.fromInput,
          currency:
            fromWallet.walletCurrency === WalletCurrency.Btc
              ? WalletCurrency.Btc
              : WalletCurrency.Usd,
        },
        toInput: {
          ...prev.toInput,
          currency:
            toWallet.walletCurrency === WalletCurrency.Btc
              ? WalletCurrency.Btc
              : WalletCurrency.Usd,
        },
      }))
    }
  }, [fromWallet, fromWallet?.walletCurrency, toWallet, toWallet?.walletCurrency])

  const onSetFormattedValues = useCallback((values: IInputValues | null) => {
    if (!values) return
    setInputFormattedValues((prev): IInputValues | null => {
      if (!prev) return values
      const sameSnapshot =
        prev.formattedAmount === values.formattedAmount &&
        prev.fromInput.formattedAmount === values.fromInput.formattedAmount &&
        prev.toInput.formattedAmount === values.toInput.formattedAmount &&
        prev.currencyInput.formattedAmount === values.currencyInput.formattedAmount &&
        prev.fromInput.currency === values.fromInput.currency &&
        prev.toInput.currency === values.toInput.currency &&
        prev.currencyInput.currency === values.currencyInput.currency
      return sameSnapshot ? prev : values
    })
  }, [])

  const fieldFormatted = useCallback(
    (id: InputField["id"]) =>
      id === InputFieldType.FROM_INPUT
        ? inputFormattedValues?.fromInput.formattedAmount || ""
        : id === InputFieldType.TO_INPUT
          ? inputFormattedValues?.toInput.formattedAmount || ""
          : inputFormattedValues?.currencyInput.formattedAmount || "",
    [inputFormattedValues],
  )

  const typedValue = useCallback(
    (id: InputField["id"]) => {
      const digits = inputFormattedValues?.formattedAmount ?? ""
      if (!digits) return ""
      const curr =
        id === InputFieldType.FROM_INPUT
          ? inputValues.fromInput.currency
          : id === InputFieldType.TO_INPUT
            ? inputValues.toInput.currency
            : displayCurrency
      const isBtc = curr === WalletCurrency.Btc
      return isBtc ? digits : `${getCurrencySymbol({ currency: curr })}${digits}`
    },
    [inputFormattedValues, inputValues, displayCurrency, getCurrencySymbol],
  )

  const renderValue = useCallback(
    (id: InputField["id"]) =>
      isTyping && typingInputId === id ? typedValue(id) : fieldFormatted(id),
    [isTyping, typingInputId, typedValue, fieldFormatted],
  )

  const caretSelectionFor = useCallback(
    (id: InputField["id"]) => {
      const value = renderValue(id) ?? ""
      const satIdx =
        value.indexOf(" SAT") >= 0
          ? value.indexOf(" SAT")
          : value.toUpperCase().indexOf(" SAT")
      const pos = satIdx >= 0 ? satIdx : value.length
      return { start: pos, end: pos } as const
    },
    [renderValue],
  )

  const handleInputPress = useCallback(
    (id: InputField["id"]) => {
      const ref = id === InputFieldType.FROM_INPUT ? fromInputRef : toInputRef
      const value = renderValue(id) ?? ""
      const satIdx =
        value.indexOf(" SAT") >= 0
          ? value.indexOf(" SAT")
          : value.toUpperCase().indexOf(" SAT")
      const pos = satIdx >= 0 ? satIdx : value.length

      const inputToFocus =
        id === InputFieldType.FROM_INPUT
          ? inputFormattedValues?.fromInput ?? inputValues.fromInput
          : inputFormattedValues?.toInput ?? inputValues.toInput

      setFocusedInputValues({ ...inputToFocus })

      setTimeout(() => {
        ref.current?.focus()
        ref.current?.setNativeProps({ selection: { start: pos, end: pos } })
      }, 10)
    },
    [inputFormattedValues, inputValues, renderValue],
  )

  useEffect(() => {
    if (displayCurrency === WalletCurrency.Usd && fromInputRef.current) {
      const value = renderValue(InputFieldType.FROM_INPUT) ?? ""
      const satIdx =
        value.indexOf(" SAT") >= 0
          ? value.indexOf(" SAT")
          : value.toUpperCase().indexOf(" SAT")
      const pos = satIdx >= 0 ? satIdx : value.length

      setTimeout(() => {
        fromInputRef.current?.setNativeProps({ selection: { start: pos, end: pos } })
      }, 100)
    }
  }, [displayCurrency, renderValue])

  const rightIcon = useMemo(
    () => (
      <View style={styles.iconSlotContainer}>
        {isTyping ? <ActivityIndicator /> : null}
      </View>
    ),
    [isTyping, styles.iconSlotContainer],
  )

  if (!data?.me?.defaultAccount || !fromWallet) return <></>

  const stripApprox = (s?: string) => (s ? s.replace(/^\s*~\s*/, "") : s)
  const ensureApprox = (s?: string) => (s ? (s.trim().startsWith("~") ? s : `~ ${s}`) : s)

  const toggleInputs = () => {
    if (uiLocked) return
    setUiLocked(true)

    const currentActiveAmount =
      moneyAmount ||
      inputFormattedValues?.fromInput?.amount ||
      inputValues.fromInput.amount

    const currentFocusedId = focusedInputValues?.id ?? null
    const newFocusedId =
      currentFocusedId && currentFocusedId !== InputFieldType.CURRENCY_INPUT
        ? currentFocusedId === InputFieldType.FROM_INPUT
          ? InputFieldType.TO_INPUT
          : InputFieldType.FROM_INPUT
        : null

    if (newFocusedId) {
      const baseTarget =
        newFocusedId === InputFieldType.FROM_INPUT
          ? (inputValues.toInput as InputField)
          : (inputValues.fromInput as InputField)

      setFocusedInputValues({
        ...baseTarget,
        id: newFocusedId,
        isFocused: true,
        amount: currentActiveAmount,
      })
    }

    if (!newFocusedId) {
      setFocusedInputValues(null)
    }

    setInputValues((prev) => ({
      ...prev,
      fromInput: {
        ...prev.toInput,
        id: InputFieldType.FROM_INPUT,
        isFocused: newFocusedId === InputFieldType.FROM_INPUT,
      },
      toInput: {
        ...prev.fromInput,
        id: InputFieldType.TO_INPUT,
        isFocused: newFocusedId === InputFieldType.TO_INPUT,
      },
      currencyInput: {
        ...prev.currencyInput,
        isFocused: currentFocusedId === InputFieldType.CURRENCY_INPUT,
      },
    }))

    setInputFormattedValues((prev: IInputValues | null): IInputValues | null => {
      if (!prev) return prev

      const swappedFrom: InputField = {
        ...prev.toInput,
        id: InputFieldType.FROM_INPUT,
        isFocused: newFocusedId === InputFieldType.FROM_INPUT,
      }
      const swappedTo: InputField = {
        ...prev.fromInput,
        id: InputFieldType.TO_INPUT,
        isFocused: newFocusedId === InputFieldType.TO_INPUT,
      }
      const normalizedFrom: InputField = {
        ...swappedFrom,
        formattedAmount: stripApprox(swappedFrom.formattedAmount) ?? "",
      }
      const normalizedTo: InputField = {
        ...swappedTo,
        formattedAmount: ensureApprox(swappedTo.formattedAmount) ?? "",
      }
      return {
        ...prev,
        fromInput: normalizedFrom,
        toInput: normalizedTo,
        currencyInput: {
          ...prev.currencyInput,
          isFocused: currentFocusedId === InputFieldType.CURRENCY_INPUT,
        },
        formattedAmount: prev.formattedAmount,
      }
    })

    if (toggleWallet) toggleWallet()
    if (currentActiveAmount) handleSetMoneyAmount(currentActiveAmount)
  }

  const btcWalletBalance = toBtcMoneyAmount(btcWallet?.balance ?? NaN)
  const usdWalletBalance = toUsdMoneyAmount(usdWallet?.balance ?? NaN)

  const fromWalletBalance =
    fromWallet.walletCurrency === WalletCurrency.Btc ? btcWalletBalance : usdWalletBalance
  const toWalletBalance =
    toWallet.walletCurrency === WalletCurrency.Btc ? btcWalletBalance : usdWalletBalance

  const fromWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: fromWalletBalance })
  const fromSatsFormatted =
    fromWallet.walletCurrency === WalletCurrency.Usd &&
    displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({ moneyAmount: fromWalletBalance })

  const toWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: toWalletBalance })
  const toSatsFormatted =
    toWallet.walletCurrency === WalletCurrency.Usd &&
    displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({ moneyAmount: toWalletBalance })

  let amountFieldError: string | undefined = undefined

  if (
    lessThan({
      value: fromWalletBalance,
      lessThan: settlementSendAmount,
    })
  ) {
    amountFieldError = LL.SendBitcoinScreen.amountExceed({
      balance: fromWalletBalanceFormatted,
    })
  }

  const setAmountToBalancePercentage = (percentage: number) => {
    if (uiLocked) return
    setUiLocked(true)
    setInitialAmount(
      toWalletAmount({
        amount: Math.round((fromWallet.balance * percentage) / 100),
        currency: fromWallet.walletCurrency,
      }),
    )
  }

  const moveToNextScreen = () => {
    navigation.navigate("conversionConfirmation", {
      fromWalletCurrency: fromWallet.walletCurrency,
      moneyAmount,
    })
  }

  return (
    <Screen preset="fixed">
      <View style={styles.styleWalletContainer}>
        <View style={styles.walletSelectorContainer}>
          <View style={styles.fromFieldContainer}>
            <Input
              ref={fromInputRef}
              value={renderValue(InputFieldType.FROM_INPUT)}
              onFocus={() =>
                setFocusedInputValues(
                  inputFormattedValues?.fromInput ?? { ...inputValues.fromInput },
                )
              }
              onChangeText={() => {}}
              showSoftInputOnFocus={false}
              containerStyle={[styles.primaryNumberContainer, styles.inputWithOverlay]}
              inputStyle={styles.primaryNumberText}
              placeholder={
                fromWallet.walletCurrency === WalletCurrency.Usd ? "$0" : "0 SAT"
              }
              placeholderTextColor={colors.grey3}
              inputContainerStyle={styles.primaryNumberInputContainer}
              renderErrorMessage={false}
              rightIcon={rightIcon}
              selection={caretSelectionFor(InputFieldType.FROM_INPUT)}
              pointerEvents="none"
            />
            <TouchableOpacity
              style={styles.inputOverlay}
              activeOpacity={1}
              onPress={() => overlaysReady && handleInputPress(InputFieldType.FROM_INPUT)}
            />
            <View style={styles.rightColumn}>
              <View style={styles.currencyBubbleText}>
                <GaloyCurrencyBubbleText
                  currency={fromWallet.walletCurrency}
                  textSize="p2"
                  containerSize="medium"
                />
              </View>
              <View style={styles.walletSelectorBalanceContainer}>
                <Text style={styles.convertText}>{fromWalletBalanceFormatted}</Text>
                <Text style={styles.convertText}>{fromSatsFormatted}</Text>
              </View>
            </View>
          </View>

          <View style={styles.walletSeparator}>
            <View style={styles.line} />
            <TouchableOpacity
              style={styles.switchButton}
              disabled={!canToggleWallet || uiLocked}
              onPress={toggleInputs}
            >
              <Icon name="arrow-down-outline" color={colors.primary} size={25} />
            </TouchableOpacity>
          </View>

          <View style={styles.toFieldContainer}>
            <Input
              ref={toInputRef}
              value={renderValue(InputFieldType.TO_INPUT)}
              onFocus={() =>
                setFocusedInputValues(
                  inputFormattedValues?.toInput ?? { ...inputValues.toInput },
                )
              }
              onChangeText={() => {}}
              showSoftInputOnFocus={false}
              containerStyle={[styles.primaryNumberContainer, styles.inputWithOverlay]}
              inputStyle={styles.primaryNumberText}
              placeholder={
                fromWallet.walletCurrency === WalletCurrency.Usd ? "0 SAT" : "$0"
              }
              placeholderTextColor={colors.grey3}
              inputContainerStyle={styles.primaryNumberInputContainer}
              renderErrorMessage={false}
              rightIcon={rightIcon}
              selection={caretSelectionFor(InputFieldType.TO_INPUT)}
              pointerEvents="none"
            />
            <TouchableOpacity
              style={styles.inputOverlay}
              activeOpacity={1}
              onPress={() => overlaysReady && handleInputPress(InputFieldType.TO_INPUT)}
            />
            <View style={styles.rightColumn}>
              <View style={styles.currencyBubbleText}>
                <GaloyCurrencyBubbleText
                  currency={toWallet.walletCurrency}
                  textSize="p2"
                  containerSize="medium"
                />
              </View>
              <View style={styles.walletSelectorBalanceContainer}>
                <Text style={styles.convertText}>{toWalletBalanceFormatted}</Text>
                <Text style={styles.convertText}>{toSatsFormatted}</Text>
              </View>
            </View>
          </View>
        </View>

        {displayCurrency !== WalletCurrency.Usd && (
          <View style={styles.currencyInputContainer}>
            <CurrencyInputModal
              inputValue={renderValue(InputFieldType.CURRENCY_INPUT)}
              onFocus={() =>
                setFocusedInputValues(
                  inputFormattedValues?.currencyInput ?? { ...inputValues.currencyInput },
                )
              }
              onChangeText={() => {}}
              defaultCurrency={displayCurrency}
              placeholder={`${getCurrencySymbol({ currency: displayCurrency })}0`}
              rightIcon={rightIcon}
            />
          </View>
        )}

        <View style={styles.errorBarContainer}>
          {amountFieldError ? (
            <View style={styles.errorContainer}>
              <GaloyIcon color={colors._white} name="warning" size={20} />
              <Text color={colors._white} type="p3">
                {amountFieldError}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.flexArea}>
        <View style={styles.percentageContainer}>
          <View style={styles.percentageFieldContainer}>
            <TouchableOpacity
              {...testProps("convert-25%")}
              style={styles.percentageField}
              disabled={uiLocked}
              onPress={() => setAmountToBalancePercentage(25)}
            >
              <Text style={styles.percentageFieldText}>25%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...testProps("convert-50%")}
              style={styles.percentageField}
              disabled={uiLocked}
              onPress={() => setAmountToBalancePercentage(50)}
            >
              <Text style={styles.percentageFieldText}>50%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...testProps("convert-75%")}
              style={styles.percentageField}
              disabled={uiLocked}
              onPress={() => setAmountToBalancePercentage(75)}
            >
              <Text style={styles.percentageFieldText}>75%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...testProps("convert-100%")}
              style={styles.percentageField}
              disabled={uiLocked}
              onPress={() => setAmountToBalancePercentage(100)}
            >
              <Text style={styles.percentageFieldText}>100%</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.keyboardContainer}>
          <AmountInputScreen
            inputValues={inputValues}
            convertMoneyAmount={convertMoneyAmount}
            onAmountChange={handleSetMoneyAmount}
            onSetFormattedAmount={onSetFormattedValues}
            focusedInput={focusedInputValues}
            initialAmount={initialAmount}
            responsive
            debounceMs={1000}
            onTypingChange={(typing, focusedId) => {
              setIsTyping(typing)
              setTypingInputId(typing ? focusedId : null)
            }}
            onAfterRecalc={() => setUiLocked(false)}
          />
        </View>
      </View>

      <GaloyPrimaryButton
        title={LL.ConversionDetailsScreen.reviewTransfer()}
        containerStyle={styles.buttonContainer}
        disabled={!isValidAmount}
        onPress={moveToNextScreen}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }, currencyInput: boolean) => ({
  iconSlotContainer: {
    width: 30,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  styleWalletContainer: {
    flexDirection: "column",
    marginHorizontal: 20,
    marginTop: 16,
    ...(currencyInput ? { minHeight: 70 } : {}),
  },
  walletSelectorContainer: {
    flexDirection: "column",
    backgroundColor: colors.grey5,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
  },
  fromFieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 6,
    marginBottom: 4,
    position: "relative",
  },
  toFieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 6,
    position: "relative",
  },
  inputWithOverlay: {
    position: "relative",
  },
  inputOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  walletSeparator: {
    flexDirection: "row",
    height: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginVertical: 6,
  },
  line: { backgroundColor: colors.grey4, height: 1, flex: 1 },
  switchButton: {
    position: "absolute",
    left: 100,
    height: 43,
    width: 43,
    borderRadius: 50,
    backgroundColor: colors.grey4,
    justifyContent: "center",
    alignItems: "center",
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
  currencyInputContainer: {
    marginTop: 10,
  },
  flexArea: {
    flex: 1,
    minHeight: 0,
    marginBottom: 20,
  },
  percentageContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  percentageFieldContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flex: 1,
    flexWrap: "wrap",
    gap: 12,
  },
  percentageField: {
    backgroundColor: colors.grey5,
    borderRadius: 100,
    alignItems: "center",
    minWidth: 50,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginVertical: 6,
  },
  percentageFieldText: { color: colors.primary, fontWeight: "bold" },
  keyboardContainer: {
    flex: 1,
    maxHeight: 350,
    maxWidth: 450,
    paddingHorizontal: 45,
    paddingVertical: 15,
    justifyContent: "flex-end",
  },
  primaryNumberContainer: { flex: 1, paddingHorizontal: 0 },
  primaryNumberText: {
    fontSize: 20,
    lineHeight: 24,
    flex: 1,
    fontWeight: "600",
    padding: 0,
    margin: 0,
  },
  primaryNumberInputContainer: { borderBottomWidth: 0, paddingBottom: 0 },
  errorBarContainer: {
    height: 44,
    marginTop: 8,
  },
  errorContainer: {
    minHeight: 44,
    alignItems: "center",
    backgroundColor: colors.error9,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 6,
  },
  buttonContainer: { marginHorizontal: 20, marginBottom: 20 },
}))
