import React, { useCallback, useEffect, useRef, useState } from "react"
import { NavigationProp, useNavigation } from "@react-navigation/native"
import { View, TextInput, Animated, Easing, LayoutChangeEvent } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { gql } from "@apollo/client"

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
  InputValues,
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

import { Screen } from "@app/components/screen"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { CurrencyInput } from "@app/components/currency-input"
import { PercentageSelector } from "@app/components/percentage-selector"
import { WalletAmountRow, WalletToggleButton } from "@app/components/wallet-selector"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useEqualPillWidth } from "@app/components/atomic/currency-pill"
import {
  AmountInputScreen,
  ConvertInputType,
} from "@app/components/transfer-amount-input"

import { useConversionFormatting, useConversionOverlayFocus } from "./hooks"
import { BTC_SUFFIX, findBtcSuffixIndex } from "./btc-format"

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

const ANIMATION_CONFIG = {
  duration: 120,
  easing: Easing.inOut(Easing.quad),
  useNativeDriver: false,
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
  const [inputFormattedValues, setInputFormattedValues] = useState<InputValues | null>(
    null,
  )
  const [inputValues, setInputValues] = useState<InputValues>({
    fromInput: {
      id: ConvertInputType.FROM,
      currency: WalletCurrency.Btc,
      amount: toBtcMoneyAmount(0),
      isFocused: false,
      formattedAmount: "",
    },
    toInput: {
      id: ConvertInputType.TO,
      currency: WalletCurrency.Usd,
      amount: toUsdMoneyAmount(0),
      isFocused: false,
      formattedAmount: "",
    },
    currencyInput: {
      id: ConvertInputType.CURRENCY,
      currency: displayCurrency as DisplayCurrency,
      amount: toDisplayAmount({ amount: 0, currencyCode: displayCurrency }),
      isFocused: false,
      formattedAmount: "",
    },
    formattedAmount: "",
  })

  const [isTyping, setIsTyping] = useState(false)
  const [typingInputId, setTypingInputId] = useState<InputField["id"] | null>(null)
  const [lockFormattingInputId, setLockFormattingInputId] = useState<
    InputField["id"] | null
  >(null)
  const [rowHeights, setRowHeights] = useState({ from: 0, to: 0 })

  const [uiLocked, setUiLocked] = useState(false)
  const [overlaysReady, setOverlaysReady] = useState(false)
  const [loadingPercent, setLoadingPercent] = useState<number | null>(null)
  const { widthStyle: pillWidthStyle, onPillLayout } = useEqualPillWidth()

  const fromInputRef = useRef<TextInput | null>(null)
  const toInputRef = useRef<TextInput | null>(null)
  const currencyInputRef = useRef<TextInput | null>(null)
  const toggleInitiated = useRef(false)
  const pendingFocusId = useRef<ConvertInputType | null>(null)
  const hadInitialFocus = useRef(false)
  const inputAnimations = useRef(
    Object.fromEntries(
      [ConvertInputType.FROM, ConvertInputType.TO, ConvertInputType.CURRENCY].map(
        (type) => [type, new Animated.Value(0)],
      ),
    ),
  ).current

  useEffect(() => {
    const focusedId = focusedInputValues?.id

    Animated.parallel(
      [ConvertInputType.FROM, ConvertInputType.TO, ConvertInputType.CURRENCY].map(
        (type) =>
          Animated.timing(inputAnimations[type], {
            toValue: type === focusedId ? 1 : 0,
            ...ANIMATION_CONFIG,
          }),
      ),
    ).start()
  }, [focusedInputValues?.id, inputAnimations])

  const getAnimatedBackground = (type: ConvertInputType) => ({
    backgroundColor: inputAnimations[type].interpolate({
      inputRange: [0, 1],
      outputRange: [colors.grey5, colors.grey6],
    }),
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setOverlaysReady(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const { renderValue, caretSelectionFor } = useConversionFormatting({
    inputValues,
    inputFormattedValues,
    isTyping,
    typingInputId,
    lockFormattingInputId,
    displayCurrency: displayCurrency as DisplayCurrency,
    getCurrencySymbol,
  })

  const { handleInputPress, focusPhysically } = useConversionOverlayFocus({
    uiLocked,
    lockFormattingInputId,
    setLockFormattingInputId,
    setIsTyping,
    inputFormattedValues,
    inputValues,
    renderValue,
    fromInputRef,
    toInputRef,
    setFocusedInputValues,
  })
  const isCurrencyVisible = displayCurrency !== WalletCurrency.Usd
  const maxRowHeight = Math.max(rowHeights.from, rowHeights.to)
  const rowMinHeightStyle = maxRowHeight ? { minHeight: maxRowHeight } : undefined

  const setRowHeight = useCallback(
    (key: "from" | "to") => (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout
      setRowHeights((prev) => (prev[key] === height ? prev : { ...prev, [key]: height }))
    },
    [],
  )

  useEffect(() => {
    if (hadInitialFocus.current || !overlaysReady) return

    const initialId = isCurrencyVisible
      ? ConvertInputType.CURRENCY
      : ConvertInputType.FROM

    const baseTarget =
      initialId === ConvertInputType.CURRENCY
        ? inputFormattedValues?.currencyInput ?? { ...inputValues.currencyInput }
        : inputFormattedValues?.fromInput ?? { ...inputValues.fromInput }

    setFocusedInputValues({
      ...baseTarget,
      id: initialId,
      isFocused: true,
    })

    if (initialId === ConvertInputType.FROM && fromInputRef.current) {
      const value = (baseTarget.formattedAmount ?? "") as string
      const pos = findBtcSuffixIndex(value)
      setTimeout(() => {
        fromInputRef.current?.focus()
        fromInputRef.current?.setNativeProps({ selection: { start: pos, end: pos } })
      }, 10)
    }

    hadInitialFocus.current = true
  }, [overlaysReady, isCurrencyVisible, inputFormattedValues, inputValues])

  useEffect(() => {
    if (!focusedInputValues) return
    if (lockFormattingInputId && lockFormattingInputId !== focusedInputValues.id) {
      setLockFormattingInputId(null)
      setIsTyping(false)
    }
  }, [focusedInputValues, lockFormattingInputId])

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

  const onSetFormattedValues = useCallback((values: InputValues | null) => {
    if (!values) return
    setInputFormattedValues((prev): InputValues | null => {
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

  useEffect(() => {
    if (displayCurrency === WalletCurrency.Usd && fromInputRef.current) {
      const value = renderValue(ConvertInputType.FROM) ?? ""
      const pos = findBtcSuffixIndex(value)
      setTimeout(() => {
        fromInputRef.current?.setNativeProps({ selection: { start: pos, end: pos } })
      }, 100)
    }
  }, [displayCurrency, renderValue])

  if (!data?.me?.defaultAccount || !fromWallet) return <></>

  const toggleInputs = () => {
    if (uiLocked) return

    setLockFormattingInputId(null)
    setIsTyping(false)

    const currentActiveAmount =
      moneyAmount ||
      inputFormattedValues?.fromInput?.amount ||
      inputValues.fromInput.amount
    const currentFocusedId = focusedInputValues?.id ?? null
    const newFocusedId =
      currentFocusedId === ConvertInputType.FROM
        ? ConvertInputType.TO
        : ConvertInputType.FROM

    const hasValidAmountToRecalc = moneyAmount && moneyAmount.amount > 0

    if (hasValidAmountToRecalc) {
      toggleInitiated.current = true
      setUiLocked(true)
    }

    pendingFocusId.current = newFocusedId
    const baseTarget =
      newFocusedId === ConvertInputType.FROM
        ? (inputValues.toInput as InputField)
        : (inputValues.fromInput as InputField)

    setFocusedInputValues({
      ...baseTarget,
      id: newFocusedId,
      isFocused: true,
      amount: currentActiveAmount,
    })

    setInputValues((prev) => ({
      ...prev,
      fromInput: {
        ...prev.toInput,
        id: ConvertInputType.FROM,
        isFocused: newFocusedId === ConvertInputType.FROM,
      },
      toInput: {
        ...prev.fromInput,
        id: ConvertInputType.TO,
        isFocused: newFocusedId === ConvertInputType.TO,
      },
      currencyInput: {
        ...prev.currencyInput,
        isFocused: currentFocusedId === ConvertInputType.CURRENCY,
      },
    }))

    setInputFormattedValues((prev: InputValues | null): InputValues | null => {
      if (!prev) return prev

      const swappedFrom: InputField = {
        ...prev.toInput,
        id: ConvertInputType.FROM,
        isFocused: newFocusedId === ConvertInputType.FROM,
      }
      const swappedTo: InputField = {
        ...prev.fromInput,
        id: ConvertInputType.TO,
        isFocused: newFocusedId === ConvertInputType.TO,
      }

      return {
        ...prev,
        fromInput: swappedFrom,
        toInput: swappedTo,
        currencyInput: {
          ...prev.currencyInput,
          isFocused: currentFocusedId === ConvertInputType.CURRENCY,
        },
        formattedAmount: prev.formattedAmount,
      }
    })

    if (!hasValidAmountToRecalc) {
      if (toggleWallet) toggleWallet()
      focusPhysically(newFocusedId)
      pendingFocusId.current = null
    }
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
    setLoadingPercent(percentage)

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
          <Animated.View
            style={[
              styles.rowWrapTop,
              rowMinHeightStyle,
              getAnimatedBackground(ConvertInputType.FROM),
            ]}
            onLayout={setRowHeight("from")}
          >
            <WalletAmountRow
              inputRef={fromInputRef}
              value={renderValue(ConvertInputType.FROM)}
              placeholder={
                fromWallet.walletCurrency === WalletCurrency.Usd
                  ? "$0"
                  : `0 ${BTC_SUFFIX}`
              }
              selection={caretSelectionFor(ConvertInputType.FROM)}
              isLocked={uiLocked}
              onOverlayPress={() =>
                overlaysReady && !uiLocked && handleInputPress(ConvertInputType.FROM)
              }
              onFocus={() =>
                setFocusedInputValues(
                  inputFormattedValues?.fromInput ?? { ...inputValues.fromInput },
                )
              }
              currency={fromWallet.walletCurrency}
              balancePrimary={fromWalletBalanceFormatted}
              balanceSecondary={fromSatsFormatted}
              pillContainerStyle={pillWidthStyle}
              pillOnLayout={onPillLayout(fromWallet.walletCurrency)}
            />
          </Animated.View>

          <View style={styles.walletSeparator} pointerEvents="box-none">
            <View
              style={[
                styles.line,
                (focusedInputValues?.id === ConvertInputType.FROM ||
                  focusedInputValues?.id === ConvertInputType.TO) &&
                  styles.lineHidden,
              ]}
              pointerEvents="none"
            />
            <WalletToggleButton
              loading={toggleInitiated.current || isTyping || Boolean(loadingPercent)}
              disabled={!canToggleWallet || uiLocked}
              onPress={toggleInputs}
              containerStyle={styles.switchButton}
              testID="wallet-toggle-button"
            />
          </View>

          <Animated.View
            style={[
              styles.rowWrapBottom,
              rowMinHeightStyle,
              getAnimatedBackground(ConvertInputType.TO),
            ]}
            onLayout={setRowHeight("to")}
          >
            <WalletAmountRow
              inputRef={toInputRef}
              value={renderValue(ConvertInputType.TO)}
              placeholder={
                fromWallet.walletCurrency === WalletCurrency.Usd
                  ? `0 ${BTC_SUFFIX}`
                  : "$0"
              }
              selection={caretSelectionFor(ConvertInputType.TO)}
              isLocked={uiLocked}
              onOverlayPress={() =>
                overlaysReady && !uiLocked && handleInputPress(ConvertInputType.TO)
              }
              onFocus={() =>
                setFocusedInputValues(
                  inputFormattedValues?.toInput ?? { ...inputValues.toInput },
                )
              }
              currency={toWallet.walletCurrency}
              balancePrimary={toWalletBalanceFormatted}
              balanceSecondary={toSatsFormatted}
              pillContainerStyle={pillWidthStyle}
              pillOnLayout={onPillLayout(toWallet.walletCurrency)}
            />
          </Animated.View>
        </View>

        <View
          style={[styles.currencyInputContainer, uiLocked && styles.disabledOpacity]}
          pointerEvents={uiLocked ? "none" : "auto"}
        >
          {displayCurrency !== WalletCurrency.Usd && (
            <CurrencyInput
              value={renderValue(ConvertInputType.CURRENCY)}
              inputRef={currencyInputRef}
              isFocused={focusedInputValues?.id === ConvertInputType.CURRENCY}
              onFocus={() =>
                setFocusedInputValues(
                  inputFormattedValues?.currencyInput ?? { ...inputValues.currencyInput },
                )
              }
              onChangeText={() => {}}
              currency={displayCurrency}
              placeholder={`${getCurrencySymbol({ currency: displayCurrency })}0`}
              AnimatedViewStyle={getAnimatedBackground(ConvertInputType.CURRENCY)}
            />
          )}
        </View>

        <View style={styles.errorBoxWrapper}>
          {amountFieldError ? (
            <GaloyErrorBox errorMessage={amountFieldError} />
          ) : (
            <View style={styles.errorBoxSpacer} />
          )}
        </View>
      </View>

      <View style={styles.bottomStack}>
        <PercentageSelector
          isLocked={
            uiLocked || toggleInitiated.current || isTyping || Boolean(loadingPercent)
          }
          loadingPercent={loadingPercent}
          onSelect={setAmountToBalancePercentage}
          testIdPrefix="convert"
          containerStyle={styles.percentageContainer}
        />

        <View
          style={[styles.keyboardContainer, uiLocked && styles.disabledOpacity]}
          pointerEvents={uiLocked ? "none" : "auto"}
        >
          <AmountInputScreen
            inputValues={inputValues}
            convertMoneyAmount={convertMoneyAmount}
            onAmountChange={handleSetMoneyAmount}
            onSetFormattedAmount={onSetFormattedValues}
            focusedInput={focusedInputValues}
            initialAmount={initialAmount}
            compact
            debounceMs={1000}
            lockFormattingUntilBlur={Boolean(lockFormattingInputId)}
            onTypingChange={(typing, focusedId) => {
              setIsTyping(typing)
              setTypingInputId(typing ? focusedId : null)
              if (typing && focusedId) setLockFormattingInputId(focusedId)
            }}
            onAfterRecalc={() => {
              setUiLocked(false)
              setLoadingPercent(null)
              if (toggleInitiated.current) {
                toggleInitiated.current = false
                if (toggleWallet) toggleWallet()
                if (moneyAmount) handleSetMoneyAmount(moneyAmount)
                const id = pendingFocusId.current
                if (id) {
                  focusPhysically(id)
                  pendingFocusId.current = null
                }
              }
            }}
          />
        </View>

        <GaloyPrimaryButton
          title={LL.ConversionDetailsScreen.reviewTransfer()}
          containerStyle={styles.buttonContainer}
          disabled={!isValidAmount || uiLocked}
          onPress={moveToNextScreen}
          testID="next-button"
        />
      </View>
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
    paddingTop: 0,
    paddingBottom: 0,
    overflow: "hidden",
    position: "relative",
  },
  rowWrapTop: {
    marginHorizontal: -15,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 6,
  },
  rowWrapBottom: {
    marginHorizontal: -15,
    paddingHorizontal: 15,
    paddingTop: 6,
    paddingBottom: 10,
  },
  walletSeparator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginVertical: 0,
    zIndex: 2,
  },
  lineHidden: { opacity: 0 },
  line: { backgroundColor: colors.grey4, height: 1, flex: 1 },
  switchButton: {
    position: "absolute",
    left: 100,
  },
  currencyInputContainer: {
    marginTop: 10,
  },
  bottomStack: {
    flex: 1,
    justifyContent: "flex-end",
  },
  percentageContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginVertical: 10,
    gap: 12,
  },
  keyboardContainer: {
    maxWidth: 450,
    paddingHorizontal: 45,
    paddingTop: 15,
    paddingBottom: 32,
  },
  disabledOpacity: { opacity: 0.5 },
  buttonContainer: { marginHorizontal: 20, marginBottom: 20 },
  errorBoxWrapper: { marginTop: 8 },
  errorBoxSpacer: { height: 44 },
}))
