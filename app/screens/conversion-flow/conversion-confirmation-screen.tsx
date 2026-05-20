import React, { useMemo, useState } from "react"
import { TouchableOpacity, View } from "react-native"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"
import { PanGestureHandler, ScrollView } from "react-native-gesture-handler"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import crashlytics from "@react-native-firebase/crashlytics"
import {
  CommonActions,
  NavigationProp,
  RouteProp,
  useNavigation,
} from "@react-navigation/native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill"
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"
import { Screen } from "@app/components/screen"
import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import { SATS_PER_BTC, usePriceConversion } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { oppositeWalletCurrency, PaymentResultStatus } from "@app/types/payment"
import { WalletDescriptor } from "@app/types/wallets"
import { logConversionResult } from "@app/utils/analytics"
import { toastShow } from "@app/utils/toast"

import { ConversionFeeRow } from "./conversion-fee-row"
import { useConversionExecution } from "./hooks"

type Props = {
  route: RouteProp<RootStackParamList, "conversionConfirmation">
}

export const ConversionConfirmationScreen: React.FC<Props> = ({ route }) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const navigation =
    useNavigation<NavigationProp<RootStackParamList, "conversionConfirmation">>()

  const { formatMoneyAmount, displayCurrency, moneyAmountToDisplayCurrencyString } =
    useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()

  const { fromWalletCurrency, moneyAmount } = route.params
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isExecuting, setIsExecuting] = useState(false)
  const { wallets: activeWallets } = useActiveWallet()

  const { LL } = useI18nContext()
  const { widthStyle: pillWidthStyle, onPillLayout } = useEqualPillWidth()

  const wallets = useMemo(() => {
    const btc = activeWallets.find((w) => w.walletCurrency === WalletCurrency.Btc)
    const usd = activeWallets.find((w) => w.walletCurrency === WalletCurrency.Usd)
    if (!btc || !usd) return null
    return {
      btc: {
        id: btc.id,
        balance: btc.balance.amount,
        walletCurrency: btc.walletCurrency,
      },
      usd: {
        id: usd.id,
        balance: usd.balance.amount,
        walletCurrency: usd.walletCurrency,
      },
    }
  }, [activeWallets])

  const btcToUsdRate = useMemo(() => {
    if (!convertMoneyAmount) return null

    const oneBtc = toBtcMoneyAmount(SATS_PER_BTC)
    const usdEquivalent = convertMoneyAmount(oneBtc, WalletCurrency.Usd)

    return formatMoneyAmount({
      moneyAmount: usdEquivalent,
      isApproximate: false,
    })
  }, [convertMoneyAmount, formatMoneyAmount])

  const conversion = useConversionExecution({
    fromCurrency: fromWalletCurrency,
    moneyAmount,
  })

  if (!wallets || !convertMoneyAmount) {
    return null
  }

  const isFromBtc = fromWalletCurrency === WalletCurrency.Btc
  const fromWallet: WalletDescriptor<WalletCurrency> = isFromBtc
    ? { id: wallets.btc.id, currency: WalletCurrency.Btc }
    : { id: wallets.usd.id, currency: WalletCurrency.Usd }

  const toWallet: WalletDescriptor<WalletCurrency> = isFromBtc
    ? { id: wallets.usd.id, currency: WalletCurrency.Usd }
    : { id: wallets.btc.id, currency: WalletCurrency.Btc }

  const currencyLabel = (currency: WalletCurrency) =>
    currency === WalletCurrency.Btc ? LL.common.bitcoin() : LL.common.dollar()
  const fromWalletLabel = currencyLabel(fromWallet.currency)
  const toWalletLabel = currencyLabel(toWallet.currency)

  const fromAmount = convertMoneyAmount(moneyAmount, fromWallet.currency)
  const toAmount = convertMoneyAmount(moneyAmount, toWallet.currency)

  const satsEquivalent = (currency: WalletCurrency, amount: typeof fromAmount) => {
    if (currency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd) {
      return null
    }
    return moneyAmountToDisplayCurrencyString({
      moneyAmount: amount,
      isApproximate: true,
    })
  }

  const fromWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: fromAmount })
  const fromSatsFormatted = satsEquivalent(fromWallet.currency, fromAmount)

  const toWalletBalanceFormatted = formatMoneyAmount({
    moneyAmount: toAmount,
    isApproximate: true,
  })
  const toSatsFormatted = satsEquivalent(toWallet.currency, toAmount)

  const navigateToSuccess = () => {
    navigation.dispatch((state) => {
      const routes = [{ name: "Primary" }, { name: "conversionSuccess" }]
      return CommonActions.reset({
        ...state,
        routes,
        index: routes.length - 1,
      })
    })
  }

  const payWallet = async () => {
    setIsExecuting(true)
    setErrorMessage(undefined)
    try {
      const outcome = await conversion.execute()
      const succeeded = outcome.status === PaymentResultStatus.Success
      logConversionResult({
        sendingWallet: fromWalletCurrency,
        receivingWallet: oppositeWalletCurrency(fromWalletCurrency),
        paymentStatus: succeeded ? PaymentSendResult.Success : PaymentSendResult.Failure,
      })
      if (succeeded) {
        navigateToSuccess()
        ReactNativeHapticFeedback.trigger("notificationSuccess", {
          ignoreAndroidSystemSettings: true,
        })
        return
      }
      setErrorMessage(outcome.message)
      ReactNativeHapticFeedback.trigger("notificationError", {
        ignoreAndroidSystemSettings: true,
      })
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        toastShow({ message: err.message, LL })
      }
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollViewContainer}>
        <View style={styles.conversionRate}>
          <Text type="p2" style={styles.conversionRateText}>
            1 BTC = {btcToUsdRate}
          </Text>
        </View>
        <View style={styles.conversionInfoCard}>
          <View style={styles.fromFieldContainer}>
            <CurrencyPill
              currency={fromWallet.currency}
              containerSize="medium"
              containerStyle={pillWidthStyle}
              onLayout={onPillLayout(fromWallet.currency)}
            />

            <View style={styles.walletSelectorBalanceContainer}>
              <Text style={styles.conversionInfoFieldValue}>
                {fromWalletBalanceFormatted}
              </Text>
              <Text style={styles.conversionInfoFieldConvertValue}>
                {fromSatsFormatted}
              </Text>
            </View>
          </View>
          <View style={styles.walletSeparator}>
            <View style={styles.line}></View>
            <TouchableOpacity style={styles.switchButton} disabled>
              <GaloyIcon name="arrow-down" color={colors.grey3} size={25} />
            </TouchableOpacity>
          </View>
          <View style={styles.toFieldContainer}>
            <CurrencyPill
              currency={toWallet.currency}
              containerSize="medium"
              containerStyle={pillWidthStyle}
              onLayout={onPillLayout(toWallet.currency)}
            />
            <View style={styles.walletSelectorBalanceContainer}>
              <Text style={styles.conversionInfoFieldValue}>
                {toWalletBalanceFormatted}
              </Text>
              <Text style={styles.conversionInfoFieldConvertValue}>
                {toSatsFormatted}
              </Text>
            </View>
          </View>
        </View>
        {(conversion.hasFee || conversion.isQuoting || conversion.hasQuoteError) && (
          <ConversionFeeRow
            feeText={conversion.feeText}
            isLoading={conversion.isQuoting}
            hasError={conversion.hasQuoteError}
          />
        )}
        <View style={styles.infoContainer}>
          <Text style={styles.conversionInfoFieldTitle}>
            {toWallet.currency === WalletCurrency.Btc
              ? LL.ConversionConfirmationScreen.infoBitcoin()
              : LL.ConversionConfirmationScreen.infoDollar()}
          </Text>
        </View>
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </ScrollView>
      <PanGestureHandler>
        <View style={styles.sliderContainer}>
          <GaloySliderButton
            isLoading={isExecuting}
            initialText={LL.ConversionConfirmationScreen.transferButtonText({
              fromWallet: fromWalletLabel,
              toWallet: toWalletLabel,
            })}
            loadingText={LL.SendBitcoinConfirmationScreen.slideConfirming()}
            onSwipe={payWallet}
            disabled={isExecuting || !conversion.canExecute}
          />
        </View>
      </PanGestureHandler>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollViewContainer: {
    flexDirection: "column",
  },
  conversionInfoCard: {
    margin: 20,
    backgroundColor: colors.grey5,
    borderRadius: 13,
    padding: 20,
  },
  conversionRate: {
    marginHorizontal: 20,
    padding: 20,
    paddingBottom: 0,
    marginBottom: 0,
  },
  conversionRateText: {
    color: colors.grey0,
  },
  conversionInfoFieldTitle: { color: colors.grey1, lineHeight: 25, fontWeight: "400" },
  conversionInfoFieldValue: {
    color: colors.grey1,
    fontWeight: "bold",
    fontSize: 20,
  },
  conversionInfoFieldConvertValue: {
    color: colors.grey2,
    fontSize: 14,
    fontWeight: "normal",
  },
  errorContainer: {
    marginBottom: 10,
  },
  errorText: {
    color: colors.error,
    textAlign: "center",
  },
  fromFieldContainer: {
    flexDirection: "row",
    marginBottom: 15,
    alignItems: "center",
  },
  walletSelectorBalanceContainer: {
    marginTop: 5,
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "flex-end",
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
  toFieldContainer: {
    flexDirection: "row",
    marginTop: 15,
    alignItems: "center",
  },
  infoContainer: {
    marginHorizontal: 20,
    backgroundColor: colors.grey5,
    borderRadius: 6,
    padding: 20,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.black,
  },
  sliderContainer: {
    padding: 20,
  },
}))
