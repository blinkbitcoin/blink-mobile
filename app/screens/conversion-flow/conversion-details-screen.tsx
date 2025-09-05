import React, { useCallback, useEffect, useRef, useState } from "react"
import { NavigationProp, useNavigation } from "@react-navigation/native"
import { View, ActivityIndicator, TextInput } from "react-native"
import { makeStyles, useTheme } from "@rneui/themed"
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

import { ErrorBanner } from "@app/components/error-banner"
import { Screen } from "@app/components/screen"
import { CurrencyInputModal } from "@app/components/currency-input-modal"
import {
  AmountInputScreen,
  ConvertInputType,
} from "@app/components/transfer-amount-input"
import { PercentageSelector } from "@app/components/percentage-selector"
import { WalletAmountRow, WalletToggleButton } from "@app/components/wallet-selector"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"

import { useConversionFormatting, useConversionOverlayFocus } from "./hooks"

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

  const [uiLocked, setUiLocked] = useState(false)
  const [overlaysReady, setOverlaysReady] = useState(false)
  const [loadingPercent, setLoadingPercent] = useState<number | null>(null)

  const fromInputRef = useRef<TextInput | null>(null)
  const toInputRef = useRef<TextInput | null>(null)
  const toggleInitiated = useRef(false)
  const pendingFocusId = useRef<ConvertInputType | null>(null)
  const hadInitialFocus = useRef(false)

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

  useEffect(() => {
    if (!hadInitialFocus.current && overlaysReady && fromWallet && fromInputRef.current) {
      const baseTarget = inputFormattedValues?.fromInput ?? inputValues.fromInput
      setFocusedInputValues({
        ...baseTarget,
        id: ConvertInputType.FROM,
        isFocused: true,
      })

      const value = (baseTarget.formattedAmount ?? "") as string
      const satIdx =
        value.indexOf(" SAT") >= 0
          ? value.indexOf(" SAT")
          : value.toUpperCase().indexOf(" SAT")
      const pos = satIdx >= 0 ? satIdx : value.length
      setTimeout(() => {
        fromInputRef.current?.focus()
        fromInputRef.current?.setNativeProps({ selection: { start: pos, end: pos } })
      }, 10)
      hadInitialFocus.current = true
    }
  }, [overlaysReady, fromWallet, inputFormattedValues, inputValues])

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

  useEffect(() => {
    if (displayCurrency === WalletCurrency.Usd && fromInputRef.current) {
      const value = renderValue(ConvertInputType.FROM) ?? ""
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

  const rightIconFor = useCallback(
    (id: InputField["id"]) => (
      <View style={styles.iconSlotContainer}>
        {isTyping && typingInputId === id ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}
      </View>
    ),
    [isTyping, typingInputId, colors.primary, styles.iconSlotContainer],
  )

  if (!data?.me?.defaultAccount || !fromWallet) return <></>

  const stripApprox = (s?: string) => (s ? s.replace(/^\s*~\s*/, "") : s)
  const ensureApprox = (s?: string) => (s ? (s.trim().startsWith("~") ? s : `~ ${s}`) : s)

  const toggleInputs = () => {
    if (uiLocked) return

    toggleInitiated.current = true
    setLockFormattingInputId(null)
    setIsTyping(false)
    setUiLocked(true)

    const currentActiveAmount =
      moneyAmount ||
      inputFormattedValues?.fromInput?.amount ||
      inputValues.fromInput.amount
    const currentFocusedId = focusedInputValues?.id ?? null
    const newFocusedId =
      currentFocusedId === ConvertInputType.FROM
        ? ConvertInputType.TO
        : ConvertInputType.FROM

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

    setInputFormattedValues((prev: IInputValues | null): IInputValues | null => {
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
          isFocused: currentFocusedId === ConvertInputType.CURRENCY,
        },
        formattedAmount: prev.formattedAmount,
      }
    })
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
          <WalletAmountRow
            inputRef={fromInputRef}
            value={renderValue(ConvertInputType.FROM)}
            placeholder={
              fromWallet.walletCurrency === WalletCurrency.Usd ? "$0" : "0 SAT"
            }
            rightIcon={rightIconFor(ConvertInputType.FROM)}
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
          />

          <View style={styles.walletSeparator} pointerEvents="box-none">
            <View style={styles.line} pointerEvents="none" />
            <WalletToggleButton
              loading={toggleInitiated.current}
              disabled={!canToggleWallet || uiLocked}
              onPress={toggleInputs}
              containerStyle={styles.switchButton}
            />
          </View>

          <WalletAmountRow
            inputRef={toInputRef}
            value={renderValue(ConvertInputType.TO)}
            placeholder={
              fromWallet.walletCurrency === WalletCurrency.Usd ? "0 SAT" : "$0"
            }
            rightIcon={rightIconFor(ConvertInputType.TO)}
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
          />
        </View>

        <View
          style={[styles.currencyInputContainer, uiLocked && styles.disabledOpacity]}
          pointerEvents={uiLocked ? "none" : "auto"}
        >
          {displayCurrency !== WalletCurrency.Usd && (
            <CurrencyInputModal
              inputValue={renderValue(ConvertInputType.CURRENCY)}
              onFocus={() =>
                setFocusedInputValues(
                  inputFormattedValues?.currencyInput ?? { ...inputValues.currencyInput },
                )
              }
              onChangeText={() => {}}
              defaultCurrency={displayCurrency}
              placeholder={`${getCurrencySymbol({ currency: displayCurrency })}0`}
              rightIcon={rightIconFor(ConvertInputType.CURRENCY)}
            />
          )}
        </View>

        <ErrorBanner message={amountFieldError} />
      </View>

      <View style={styles.flexArea}>
        <PercentageSelector
          isLocked={uiLocked}
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
            responsive
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
      </View>

      <GaloyPrimaryButton
        title={LL.ConversionDetailsScreen.reviewTransfer()}
        containerStyle={styles.buttonContainer}
        disabled={!isValidAmount || uiLocked}
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
  walletSeparator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginVertical: 6,
    zIndex: 2,
  },
  line: { backgroundColor: colors.grey4, height: 1, flex: 1 },
  switchButton: {
    position: "absolute",
    left: 100,
  },
  switchButtonDisabled: {
    opacity: 0.5,
  },
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginVertical: 10,
    gap: 12,
  },
  keyboardContainer: {
    flex: 1,
    maxHeight: 350,
    maxWidth: 450,
    paddingHorizontal: 45,
    paddingVertical: 15,
    justifyContent: "flex-end",
  },
  disabledOpacity: { opacity: 0.5 },
  buttonContainer: { marginHorizontal: 20, marginBottom: 20 },
}))
