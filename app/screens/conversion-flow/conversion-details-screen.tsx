import React, { useCallback, useEffect, useRef, useState } from "react"
import { TouchableOpacity, View } from "react-native"

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

export const ConversionDetailsScreen = () => {
  const {
    theme: { colors },
  } = useTheme()

  const navigation =
    useNavigation<NavigationProp<RootStackParamList, "conversionDetails">>()

  // forcing price refresh
  useRealtimePriceQuery({
    fetchPolicy: "network-only",
  })

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

  useEffect(() => {
    if (!fromWallet && btcWallet && usdWallet) {
      setWallets({
        fromWallet: btcWallet,
        toWallet: usdWallet,
      })
    }
  }, [btcWallet, usdWallet, fromWallet, setWallets])

  const handleSetMoneyAmount = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>) => {
      setMoneyAmount(amount)
    },
    [setMoneyAmount],
  )

  if (!data?.me?.defaultAccount || !fromWallet) {
    // TODO: proper error handling. non possible event?
    return <></>
  }
  const [focusedInputValues, setFocusedInputValues] = useState<InputField | null>(null)
  const [initialAmount, setInitialAmount] =
    useState<MoneyAmount<WalletOrDisplayCurrency>>()
  const [inputFormattedValues, setInputFormattedValues] = useState<IInputValues | null>(
    null,
  )
  const [inputValues, setInputValues] = useState<IInputValues>({
    fromInput: {
      id: "fromInput",
      currency:
        fromWallet.walletCurrency === WalletCurrency.Btc
          ? WalletCurrency.Btc
          : WalletCurrency.Usd,
      amount:
        fromWallet.walletCurrency === WalletCurrency.Btc
          ? toBtcMoneyAmount(0)
          : toUsdMoneyAmount(0),
      isFocused: false,
      formattedAmount: "",
    },
    toInput: {
      id: "toInput",
      currency:
        toWallet.walletCurrency === WalletCurrency.Btc
          ? WalletCurrency.Btc
          : WalletCurrency.Usd,
      amount:
        toWallet.walletCurrency === WalletCurrency.Btc
          ? toBtcMoneyAmount(0)
          : toUsdMoneyAmount(0),
      isFocused: false,
      formattedAmount: "",
    },
    currencyInput: {
      id: "currencyInput",
      currency: displayCurrency as DisplayCurrency,
      amount: toDisplayAmount({ amount: 0, currencyCode: displayCurrency }),
      isFocused: false,
      formattedAmount: "",
    },
    formattedAmount: "",
  })
  const toggleInputs = () => {
    setInputValues((prev) => {
      return {
        ...prev,
        fromInput: {
          ...prev.fromInput,
          currency: prev.toInput.currency,
          amount: prev.toInput.amount,
        },
        toInput: {
          ...prev.toInput,
          currency: prev.fromInput.currency,
          amount: prev.fromInput.amount,
        },
      }
    })
  }

  const formattedInputValues = useCallback(
    (values: IInputValues | null) => {
      if (!values) return

      setInputFormattedValues(values)
      handleSetMoneyAmount(values.fromInput.amount)
    },
    [setInputFormattedValues],
  )

  const btcWalletBalance = toBtcMoneyAmount(btcWallet?.balance ?? NaN)
  const usdWalletBalance = toUsdMoneyAmount(usdWallet?.balance ?? NaN)

  const currencySymbol = getCurrencySymbol({
    currency: displayCurrency,
  })

  const fromWalletBalance =
    fromWallet.walletCurrency === WalletCurrency.Btc ? btcWalletBalance : usdWalletBalance
  const toWalletBalance =
    toWallet.walletCurrency === WalletCurrency.Btc ? btcWalletBalance : usdWalletBalance

  const fromWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: fromWalletBalance })
  const fromSatsFormatted =
    fromWallet.walletCurrency === WalletCurrency.Usd &&
    displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({
          moneyAmount: fromWalletBalance,
        })

  const toWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: toWalletBalance })
  const toSatsFormatted =
    toWallet.walletCurrency === WalletCurrency.Usd &&
    displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({
          moneyAmount: toWalletBalance,
        })

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
              value={
                inputFormattedValues?.fromInput.isFocused &&
                inputFormattedValues?.fromInput.currency !== WalletCurrency.Btc
                  ? `${
                      inputFormattedValues?.formattedAmount
                        ? getCurrencySymbol({
                            currency: inputFormattedValues?.fromInput.currency,
                          })
                        : ""
                    }${inputFormattedValues?.formattedAmount}`
                  : inputFormattedValues?.fromInput.formattedAmount
              }
              onFocus={() => {
                setFocusedInputValues(
                  inputFormattedValues?.fromInput ?? { ...inputValues.fromInput },
                )
              }}
              onChangeText={(e) => {
                // remove commas for ease of calculation later on
                const val = e.replaceAll(",", "")
                // TODO adjust for currencies that use commas instead of decimals

                // test for string input that can be either numerical or float
                if (/^\d*\.?\d*$/.test(val.trim())) {
                  const num = Number(val)
                  //onPaste(num)
                }
              }}
              showSoftInputOnFocus={false}
              containerStyle={styles.primaryNumberContainer}
              inputStyle={styles.primaryNumberText}
              placeholder={
                fromWallet.walletCurrency === WalletCurrency.Usd ? "$0" : "0 SAT"
              }
              placeholderTextColor={colors.grey3}
              inputContainerStyle={styles.primaryNumberInputContainer}
              renderErrorMessage={false}
              autoFocus={displayCurrency === WalletCurrency.Usd}
            />
            <View>
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
            <View style={styles.line}></View>
            <TouchableOpacity
              style={styles.switchButton}
              disabled={!canToggleWallet}
              onPress={() => {
                toggleInputs()
                if (toggleWallet) {
                  toggleWallet()
                }
              }}
            >
              <Icon name="arrow-down-outline" color={colors.primary} size={25} />
            </TouchableOpacity>
          </View>
          <View style={styles.toFieldContainer}>
            <Input
              value={
                inputFormattedValues?.toInput.isFocused &&
                inputFormattedValues?.toInput.currency !== WalletCurrency.Btc
                  ? `${
                      inputFormattedValues?.formattedAmount
                        ? "~ " +
                          getCurrencySymbol({
                            currency: inputFormattedValues?.toInput.currency,
                          })
                        : ""
                    }${inputFormattedValues?.formattedAmount}`
                  : inputFormattedValues?.toInput.formattedAmount
              }
              onFocus={() => {
                setFocusedInputValues(
                  inputFormattedValues?.toInput ?? { ...inputValues.toInput },
                )
              }}
              onChangeText={(e) => {
                // remove commas for ease of calculation later on
                const val = e.replaceAll(",", "")
                // TODO adjust for currencies that use commas instead of decimals

                // test for string input that can be either numerical or float
                if (/^\d*\.?\d*$/.test(val.trim())) {
                  const num = Number(val)
                  //onPaste(num)
                }
              }}
              showSoftInputOnFocus={false}
              containerStyle={styles.primaryNumberContainer}
              inputStyle={styles.primaryNumberText}
              placeholder={
                fromWallet.walletCurrency === WalletCurrency.Usd ? "0 SAT" : "$0"
              }
              placeholderTextColor={colors.grey3}
              inputContainerStyle={styles.primaryNumberInputContainer}
              renderErrorMessage={false}
            />
            <View>
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
          <CurrencyInputModal
            inputValue={
              inputFormattedValues?.currencyInput.isFocused
                ? `${inputFormattedValues?.formattedAmount ? currencySymbol : ""}${inputFormattedValues?.formattedAmount}`
                : inputFormattedValues?.currencyInput.formattedAmount
            }
            onFocus={() => {
              setFocusedInputValues(
                inputFormattedValues?.currencyInput ?? { ...inputValues.currencyInput },
              )
            }}
            onChangeText={(e) => {
              // remove commas for ease of calculation later on
              const val = e.replaceAll(",", "")
              // TODO adjust for currencies that use commas instead of decimals

              // test for string input that can be either numerical or float
              if (/^\d*\.?\d*$/.test(val.trim())) {
                const num = Number(val)
                //onPaste(num)
              }
            }}
            defaultCurrency={displayCurrency}
            placeholder={`${currencySymbol}0`}
          />
        )}
        {amountFieldError && (
          <View style={styles.errorContainer}>
            <GaloyIcon color={colors._white} name="warning" size={20} />
            <Text color={colors._white} type="p3">
              {amountFieldError}
            </Text>
          </View>
        )}
      </View>
      <View
        style={{
          flex: 1,
          gap: 13,
          marginBottom: 20,
          minHeight: 0,
        }}
      >
        <View style={styles.percentageContainer}>
          <View style={styles.percentageFieldContainer}>
            <TouchableOpacity
              {...testProps("convert-25%")}
              style={styles.percentageField}
              onPress={() => setAmountToBalancePercentage(25)}
            >
              <Text style={styles.percentageFieldText}>25%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...testProps("convert-50%")}
              style={styles.percentageField}
              onPress={() => setAmountToBalancePercentage(50)}
            >
              <Text style={styles.percentageFieldText}>50%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...testProps("convert-75%")}
              style={styles.percentageField}
              onPress={() => setAmountToBalancePercentage(75)}
            >
              <Text style={styles.percentageFieldText}>75%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...testProps("convert-100%")}
              style={styles.percentageField}
              onPress={() => setAmountToBalancePercentage(100)}
            >
              <Text style={styles.percentageFieldText}>100%</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1, minHeight: 0, maxHeight: 400, paddingHorizontal: 30 }}>
          <AmountInputScreen
            inputValues={inputValues}
            convertMoneyAmount={convertMoneyAmount}
            onAmountChange={handleSetMoneyAmount}
            onSetFormattedAmount={formattedInputValues}
            focusedInput={focusedInputValues}
            initialAmount={initialAmount}
            responsive
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
  styleWalletContainer: {
    flexDirection: "column",
    margin: 20,
    flex: 1,
    ...(currencyInput ? { minHeight: 70 } : {}),
    gap: 10,
  },
  toFieldContainer: {
    flexDirection: "row",
    marginTop: 15,
    alignItems: "center",
  },
  walletSelectorContainer: {
    flexDirection: "column",
    backgroundColor: colors.grey5,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  walletSeparator: {
    flexDirection: "row",
    height: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  line: {
    backgroundColor: colors.grey4,
    height: 1,
    flex: 1,
  },
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
  fromFieldContainer: {
    flexDirection: "row",
    marginBottom: 15,
    alignItems: "center",
  },
  walletSelectorBalanceContainer: {
    marginTop: 5,
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  convertText: {
    textAlign: "right",
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
    padding: 10,
    borderRadius: 100,
    alignItems: "center",
    marginVertical: 5,
    minWidth: 50,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  percentageFieldText: {
    color: colors.primary,
    fontWeight: "bold",
  },
  percentageContainer: {
    flexDirection: "row",
  },
  buttonContainer: { marginHorizontal: 20, marginBottom: 20 },
  errorContainer: {
    alignItems: "center",
    backgroundColor: colors.error9,
    borderRadius: 8,
    padding: 7,
    flexDirection: "row",
    gap: 5,
  },
  primaryNumberContainer: {
    flex: 1,
  },
  primaryNumberText: {
    fontSize: 20,
    lineHeight: 24,
    flex: 1,
    fontWeight: "600",
    padding: 0,
    margin: 0,
  },
  primaryNumberInputContainer: {
    borderBottomWidth: 0,
  },
  currencyBubbleText: { display: "flex", alignItems: "flex-end" },
}))
