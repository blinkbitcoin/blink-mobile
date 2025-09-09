import React, { useEffect } from "react"
import { Platform, TouchableOpacity, View } from "react-native"
import { ScrollView } from "react-native-gesture-handler"

import { gql } from "@apollo/client"
import SwitchButton from "@app/assets/icons-redesign/transfer.svg"
import { AmountInput } from "@app/components/amount-input"
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
import { useConvertMoneyDetails } from "@app/screens/conversion-flow/use-convert-money-details"
import {
  DisplayCurrency,
  lessThan,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  toWalletAmount,
} from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"
import { NavigationProp, useNavigation } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rneui/themed"

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

  const styles = useStyles()
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
  const { formatDisplayAndWalletAmount } = useDisplayCurrency()

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

  if (!data?.me?.defaultAccount || !fromWallet) {
    // TODO: proper error handling. non possible event?
    return <></>
  }

  const btcWalletBalance = toBtcMoneyAmount(btcWallet?.balance ?? NaN)
  const usdWalletBalance = toUsdMoneyAmount(usdWallet?.balance ?? NaN)

  const fromWalletBalance =
    fromWallet.walletCurrency === WalletCurrency.Btc ? btcWalletBalance : usdWalletBalance
  const toWalletBalance =
    toWallet.walletCurrency === WalletCurrency.Btc ? btcWalletBalance : usdWalletBalance
  const fromWalletBalanceFormatted = formatDisplayAndWalletAmount({
    displayAmount: convertMoneyAmount(fromWalletBalance, DisplayCurrency),
    walletAmount: fromWalletBalance,
  })

  const toWalletBalanceFormatted = formatDisplayAndWalletAmount({
    displayAmount: convertMoneyAmount(toWalletBalance, DisplayCurrency),
    walletAmount: toWalletBalance,
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
    setMoneyAmount(
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
      <ScrollView style={styles.scrollViewContainer}>
        <View style={styles.walletSelectorContainer}>
          <View style={styles.walletsContainer}>
            <View style={styles.fromFieldContainer}>
              <View style={styles.walletSelectorInfoContainer}>
                {fromWallet.walletCurrency === WalletCurrency.Btc ? (
                  <Text
                    style={styles.walletCurrencyText}
                  >{`${LL.common.from()} ${LL.common.btcAccount()}`}</Text>
                ) : (
                  <Text
                    style={styles.walletCurrencyText}
                  >{`${LL.common.from()} ${LL.common.usdAccount()}`}</Text>
                )}
                <View style={styles.walletSelectorBalanceContainer}>
                  <Text>{fromWalletBalanceFormatted}</Text>
                </View>
              </View>
            </View>
            <View style={styles.walletSeparator}>
              <View style={styles.line}></View>
              <TouchableOpacity
                style={styles.switchButton}
                disabled={!canToggleWallet}
                onPress={toggleWallet}
              >
                <SwitchButton color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.toFieldContainer}>
              <View style={styles.walletSelectorInfoContainer}>
                {toWallet.walletCurrency === WalletCurrency.Btc ? (
                  <Text
                    style={styles.walletCurrencyText}
                  >{`${LL.common.to()} ${LL.common.btcAccount()}`}</Text>
                ) : (
                  <Text
                    style={styles.walletCurrencyText}
                  >{`${LL.common.to()} ${LL.common.usdAccount()}`}</Text>
                )}
                <View style={styles.walletSelectorBalanceContainer}>
                  <Text>{toWalletBalanceFormatted}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <AmountInput
            unitOfAccountAmount={moneyAmount}
            walletCurrency={fromWallet.walletCurrency}
            setAmount={setMoneyAmount}
            convertMoneyAmount={convertMoneyAmount}
          />
          {amountFieldError && (
            <View style={styles.errorContainer}>
              <Text color={colors.error}>{amountFieldError}</Text>
            </View>
          )}
        </View>
        <View style={styles.fieldContainer}>
          <View style={styles.percentageLabelContainer}>
            <Text style={styles.percentageFieldLabel}>
              {LL.TransferScreen.percentageToConvert()}
            </Text>
          </View>
          <View style={styles.percentageContainer}>
            <View style={styles.percentageFieldContainer}>
              <TouchableOpacity
                {...testProps("convert-25%")}
                style={styles.percentageField}
                onPress={() => setAmountToBalancePercentage(25)}
              >
                <Text>25%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...testProps("convert-50%")}
                style={styles.percentageField}
                onPress={() => setAmountToBalancePercentage(50)}
              >
                <Text>50%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...testProps("convert-75%")}
                style={styles.percentageField}
                onPress={() => setAmountToBalancePercentage(75)}
              >
                <Text>75%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...testProps("convert-100%")}
                style={styles.percentageField}
                onPress={() => setAmountToBalancePercentage(100)}
              >
                <Text>100%</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      <GaloyPrimaryButton
        title={LL.common.next()}
        containerStyle={styles.buttonContainer}
        disabled={!isValidAmount}
        onPress={moveToNextScreen}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollViewContainer: {
    flex: 1,
    flexDirection: "column",
    margin: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  toFieldContainer: {
    flexDirection: "row",
    marginTop: 15,
    marginRight: 75,
  },
  walletSelectorContainer: {
    flexDirection: "row",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  walletsContainer: {
    flex: 1,
  },
  walletSeparator: {
    flexDirection: "row",
    height: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  line: {
    backgroundColor: colors.grey4,
    height: 1,
    flex: 1,
  },
  switchButton: {
    height: 50,
    width: 50,
    borderRadius: 50,
    elevation: Platform.OS === "android" ? 50 : 0,
    backgroundColor: colors.grey4,
    justifyContent: "center",
    alignItems: "center",
  },
  fromFieldContainer: {
    flexDirection: "row",
    marginBottom: 15,
    marginRight: 75,
  },
  percentageFieldLabel: {
    fontSize: 12,
    fontWeight: "bold",
    padding: 10,
  },
  walletSelectorInfoContainer: {
    flex: 1,
    flexDirection: "column",
  },
  walletCurrencyText: {
    fontWeight: "bold",
    fontSize: 18,
  },
  walletSelectorBalanceContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  percentageFieldContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    flex: 1,
    flexWrap: "wrap",
  },
  percentageField: {
    backgroundColor: colors.grey5,
    padding: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 5,
    minWidth: 80,
  },
  percentageLabelContainer: {
    flex: 1,
  },
  percentageContainer: {
    flexDirection: "row",
  },
  buttonContainer: { marginHorizontal: 20, marginBottom: 20 },
  errorContainer: {
    marginTop: 10,
    alignItems: "center",
  },
}))
