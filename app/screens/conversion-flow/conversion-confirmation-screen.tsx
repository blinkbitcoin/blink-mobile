import { GraphQLError } from "graphql"
import React, { useMemo, useState } from "react"
import { TouchableOpacity, View } from "react-native"
import { PanGestureHandler, ScrollView } from "react-native-gesture-handler"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import { Screen } from "@app/components/screen"
import {
  HomeAuthedDocument,
  PaymentSendResult,
  useConversionScreenQuery,
  useIntraLedgerPaymentSendMutation,
  useIntraLedgerUsdPaymentSendMutation,
  WalletCurrency,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getErrorMessages } from "@app/graphql/utils"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { SATS_PER_BTC, usePriceConversion } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { WalletDescriptor } from "@app/types/wallets"
import { logConversionAttempt, logConversionResult } from "@app/utils/analytics"
import { toastShow } from "@app/utils/toast"
import crashlytics from "@react-native-firebase/crashlytics"
import {
  CommonActions,
  NavigationProp,
  RouteProp,
  useNavigation,
} from "@react-navigation/native"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"
import { GaloyCurrencyBubbleText } from "@app/components/atomic/galoy-currency-bubble-text"
import Icon from "react-native-vector-icons/Ionicons"
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"

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
  const isAuthed = useIsAuthed()

  const [intraLedgerPaymentSend, { loading: intraLedgerPaymentSendLoading }] =
    useIntraLedgerPaymentSendMutation()
  const [intraLedgerUsdPaymentSend, { loading: intraLedgerUsdPaymentSendLoading }] =
    useIntraLedgerUsdPaymentSendMutation()
  const isLoading = intraLedgerPaymentSendLoading || intraLedgerUsdPaymentSendLoading
  const { LL } = useI18nContext()

  const { data } = useConversionScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
  const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

  const btcToUsdRate = useMemo(() => {
    if (!convertMoneyAmount) return null

    const oneBtc = toBtcMoneyAmount(SATS_PER_BTC)
    const usdEquivalent = convertMoneyAmount(oneBtc, WalletCurrency.Usd)

    return formatMoneyAmount({
      moneyAmount: usdEquivalent,
      isApproximate: false,
    })
  }, [convertMoneyAmount, formatMoneyAmount])

  if (!data?.me || !usdWallet || !btcWallet || !convertMoneyAmount) {
    // TODO: handle errors and or provide some loading state
    return null
  }

  const [fromWallet, setFromWallet] = useState<WalletDescriptor<WalletCurrency>>(
    fromWalletCurrency === WalletCurrency.Btc
      ? { id: btcWallet.id, currency: WalletCurrency.Btc }
      : { id: usdWallet.id, currency: WalletCurrency.Usd },
  )

  const [toWallet, setToWallet] = useState<WalletDescriptor<WalletCurrency>>(
    fromWalletCurrency === WalletCurrency.Btc
      ? { id: usdWallet.id, currency: WalletCurrency.Usd }
      : { id: btcWallet.id, currency: WalletCurrency.Btc },
  )

  const fromAmount = convertMoneyAmount(moneyAmount, fromWallet.currency)
  const toAmount = convertMoneyAmount(moneyAmount, toWallet.currency)

  const fromWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: fromAmount })
  const fromSatsFormatted =
    fromWallet.currency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({
          moneyAmount: fromAmount,
          isApproximate: true,
        })

  const toWalletBalanceFormatted = formatMoneyAmount({
    moneyAmount: toAmount,
    isApproximate: true,
  })
  const toSatsFormatted =
    toWallet.currency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({
          moneyAmount: toAmount,
          isApproximate: true,
        })

  const handlePaymentReturn = (
    status: PaymentSendResult,
    errorsMessage: readonly GraphQLError[] | string | undefined,
  ) => {
    if (status === "SUCCESS") {
      // navigate to next screen
      navigation.dispatch((state) => {
        const routes = [{ name: "Primary" }, { name: "conversionSuccess" }]
        return CommonActions.reset({
          ...state,
          routes,
          index: routes.length - 1,
        })
      })
      ReactNativeHapticFeedback.trigger("notificationSuccess", {
        ignoreAndroidSystemSettings: true,
      })
    }

    if (typeof errorsMessage === "string") {
      setErrorMessage(errorsMessage)
      ReactNativeHapticFeedback.trigger("notificationError", {
        ignoreAndroidSystemSettings: true,
      })
    } else if (errorsMessage?.length) {
      setErrorMessage(getErrorMessages(errorsMessage))
      ReactNativeHapticFeedback.trigger("notificationError", {
        ignoreAndroidSystemSettings: true,
      })
    }
  }

  const handlePaymentError = (error: Error) => {
    toastShow({ message: error.message, LL })
  }

  const payWallet = async () => {
    if (fromWallet.currency === WalletCurrency.Btc) {
      try {
        logConversionAttempt({
          sendingWallet: fromWallet.currency,
          receivingWallet: toWallet.currency,
        })
        const { data, errors } = await intraLedgerPaymentSend({
          variables: {
            input: {
              walletId: fromWallet?.id,
              recipientWalletId: toWallet?.id,
              amount: fromAmount.amount,
            },
          },
          refetchQueries: [HomeAuthedDocument],
        })

        const status = data?.intraLedgerPaymentSend.status

        if (!status) {
          throw new Error("Conversion failed")
        }

        logConversionResult({
          sendingWallet: fromWallet.currency,
          receivingWallet: toWallet.currency,
          paymentStatus: status,
        })
        handlePaymentReturn(
          status,
          errors || data?.intraLedgerPaymentSend.errors[0]?.message,
        )
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
          handlePaymentError(err)
        }
      }
    }
    if (fromWallet.currency === WalletCurrency.Usd) {
      try {
        logConversionAttempt({
          sendingWallet: fromWallet.currency,
          receivingWallet: toWallet.currency,
        })
        const { data, errors } = await intraLedgerUsdPaymentSend({
          variables: {
            input: {
              walletId: fromWallet?.id,
              recipientWalletId: toWallet?.id,
              amount: fromAmount.amount,
            },
          },
          refetchQueries: [HomeAuthedDocument],
        })

        const status = data?.intraLedgerUsdPaymentSend.status

        if (!status) {
          throw new Error("Conversion failed")
        }

        logConversionResult({
          sendingWallet: fromWallet.currency,
          receivingWallet: toWallet.currency,
          paymentStatus: status,
        })
        handlePaymentReturn(
          status,
          errors || data?.intraLedgerUsdPaymentSend.errors[0]?.message,
        )
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
          handlePaymentError(err)
        }
      }
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
            <GaloyCurrencyBubbleText
              currency={fromWallet.currency}
              textSize="p2"
              containerSize="medium"
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
              <Icon name="arrow-down-outline" color={colors.grey3} size={25} />
            </TouchableOpacity>
          </View>
          <View style={styles.toFieldContainer}>
            <GaloyCurrencyBubbleText
              currency={toWallet.currency}
              textSize="p2"
              containerSize="medium"
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
            isLoading={isLoading}
            initialText={LL.ConversionConfirmationScreen.transferButtonText({
              fromWallet: fromWallet.currency,
              toWallet: toWallet.currency,
            })}
            loadingText={LL.SendBitcoinConfirmationScreen.slideConfirming()}
            onSwipe={payWallet}
            disabled={isLoading}
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
  conversionInfoField: {
    marginBottom: 20,
  },
  conversionInfoFieldTitle: { color: colors.grey1, lineHeight: 25, fontWeight: "400" },
  conversionInfoFieldValue: {
    color: colors.grey0,
    fontWeight: "bold",
    fontSize: 20,
  },
  conversionInfoFieldConvertValue: {
    color: colors.grey2,
    fontSize: 14,
    fontWeight: "normal",
  },
  buttonContainer: { marginHorizontal: 20, marginBottom: 20 },
  errorContainer: {
    marginBottom: 10,
  },
  errorText: {
    color: colors.error,
    textAlign: "center",
  },
  walletSelectorContainer: {
    flexDirection: "column",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
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
