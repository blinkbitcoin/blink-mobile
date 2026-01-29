import React, { useState } from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"
import { PanGestureHandler } from "react-native-gesture-handler"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import { gql } from "@apollo/client"
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"
import { PaymentDestinationDisplay } from "@app/components/payment-destination-display"
import { Screen } from "@app/components/screen"
import { HIDDEN_AMOUNT_PLACEHOLDER } from "@app/config"
import {
  useSendBitcoinConfirmationScreenQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  addMoneyAmounts,
  DisplayCurrency,
  greaterThan,
  lessThanOrEqualTo,
  moneyAmountIsCurrencyType,
  multiplyMoneyAmounts,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  ZeroUsdMoneyAmount,
} from "@app/types/amounts"
import { logPaymentAttempt, logPaymentResult } from "@app/utils/analytics"
import crashlytics from "@react-native-firebase/crashlytics"
import { CommonActions, RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import useFee from "./use-fee"
import { useSendPayment } from "./use-send-payment"
import { useSaveLnAddressContact } from "./use-save-lnaddress-contact"
import { ellipsizeMiddle } from "@app/utils/helper"

gql`
  query sendBitcoinConfirmationScreen {
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

type Props = { route: RouteProp<RootStackParamList, "sendBitcoinConfirmation"> }

const SendBitcoinConfirmationScreen: React.FC<Props> = ({ route }) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "sendBitcoinConfirmation">>()

  const { hideAmount } = useHideAmount()
  const { widthStyle: pillWidthStyle, onPillLayout } = useEqualPillWidth()

  const { paymentDetail } = route.params

  const {
    destination,
    paymentType,
    sendingWalletDescriptor,
    sendPaymentMutation,
    getFee,
    settlementAmount,
    memo: note,
    unitOfAccountAmount,
    convertMoneyAmount,
    isSendingMax,
  } = paymentDetail

  const {
    formatDisplayAndWalletAmount,
    getSecondaryAmountIfCurrencyIsDifferent,
    formatMoneyAmount,
  } = useDisplayCurrency()
  const saveLnAddressContact = useSaveLnAddressContact()

  const { data } = useSendBitcoinConfirmationScreenQuery({ skip: !useIsAuthed() })

  const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
  const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

  const btcBalanceMoneyAmount = toBtcMoneyAmount(btcWallet?.balance)

  const usdBalanceMoneyAmount = toUsdMoneyAmount(usdWallet?.balance)

  const btcPrimaryText = formatMoneyAmount({ moneyAmount: btcBalanceMoneyAmount })
  const btcSecondaryText = formatMoneyAmount({
    moneyAmount: convertMoneyAmount(btcBalanceMoneyAmount, DisplayCurrency),
    isApproximate: true,
  })

  const usdPrimaryText = formatMoneyAmount({ moneyAmount: usdBalanceMoneyAmount })
  const usdSecondaryText = formatMoneyAmount({
    moneyAmount: convertMoneyAmount(usdBalanceMoneyAmount, WalletCurrency.Btc),
    isApproximate: true,
  })

  const [paymentError, setPaymentError] = useState<string | undefined>(undefined)
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()

  const fee = useFee(getFee)

  const defaultAmount = formatMoneyAmount({ moneyAmount: ZeroUsdMoneyAmount })
  let currencyFeeAmount = defaultAmount
  let satFeeAmount = defaultAmount

  const {
    loading: sendPaymentLoading,
    sendPayment,
    hasAttemptedSend,
  } = useSendPayment(sendPaymentMutation)

  const feeErrorText = String(LL.SendBitcoinConfirmationScreen.feeError())
  let feeDisplayText = feeErrorText
  currencyFeeAmount = feeErrorText
  satFeeAmount = feeErrorText
  if (fee.amount) {
    const feeDisplayAmount = paymentDetail.convertMoneyAmount(fee.amount, DisplayCurrency)
    feeDisplayText = formatDisplayAndWalletAmount({
      displayAmount: feeDisplayAmount,
      walletAmount: fee.amount,
    })

    currencyFeeAmount = formatMoneyAmount({
      moneyAmount: feeDisplayAmount,
    })

    const secondaryFeeAmount = getSecondaryAmountIfCurrencyIsDifferent({
      primaryAmount: feeDisplayAmount,
      walletAmount: paymentDetail.convertMoneyAmount(fee.amount, WalletCurrency.Btc),
      displayAmount: paymentDetail.convertMoneyAmount(fee.amount, DisplayCurrency),
    })
    satFeeAmount = formatMoneyAmount({
      moneyAmount: secondaryFeeAmount ?? ZeroUsdMoneyAmount,
    })
  }

  const displayAmount = paymentDetail.convertMoneyAmount(
    settlementAmount,
    DisplayCurrency,
  )

  const currencyAmount = formatMoneyAmount({
    moneyAmount: displayAmount,
  })

  const secondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: displayAmount,
    walletAmount: paymentDetail.convertMoneyAmount(settlementAmount, WalletCurrency.Btc),
    displayAmount: paymentDetail.convertMoneyAmount(settlementAmount, DisplayCurrency),
  })

  const satAmount = formatMoneyAmount({
    moneyAmount: secondaryAmount ?? ZeroUsdMoneyAmount,
  })

  const handleSendPayment = React.useCallback(async () => {
    if (!sendPayment || !sendingWalletDescriptor?.currency) {
      return sendPayment
    }

    try {
      logPaymentAttempt({
        paymentType: paymentDetail.paymentType,
        sendingWallet: sendingWalletDescriptor.currency,
      })
      const { status, errorsMessage, extraInfo, transaction } = await sendPayment()

      logPaymentResult({
        paymentType: paymentDetail.paymentType,
        paymentStatus: status,
        sendingWallet: sendingWalletDescriptor.currency,
      })

      if (status === "SUCCESS" || status === "PENDING") {
        await saveLnAddressContact({
          paymentType,
          destination,
          isMerchant:
            paymentDetail.paymentType === "lnurl" ? paymentDetail.isMerchant : undefined,
        })

        navigation.dispatch((state) => {
          const routes = [
            { name: "Primary" },
            {
              name: "sendBitcoinCompleted",
              params: {
                arrivalAtMempoolEstimate: extraInfo?.arrivalAtMempoolEstimate,
                status,
                successAction: paymentDetail?.successAction,
                preimage: extraInfo?.preimage,
                currencyAmount,
                satAmount,
                currencyFeeAmount,
                satFeeAmount,
                destination:
                  paymentDetail?.paymentType === "intraledger"
                    ? destination
                    : ellipsizeMiddle(destination, {
                        maxLength: 50,
                        maxResultLeft: 13,
                        maxResultRight: 8,
                      }),
                paymentType: paymentDetail?.paymentType,
                createdAt: transaction?.createdAt,
              },
            },
          ]
          return CommonActions.reset({
            ...state,
            routes,
            index: routes.length - 1,
          })
        })
        ReactNativeHapticFeedback.trigger("notificationSuccess", {
          ignoreAndroidSystemSettings: true,
        })
        return
      }

      if (status === "ALREADY_PAID") {
        setPaymentError(LL.SendBitcoinConfirmationScreen.invoiceAlreadyPaid())
        ReactNativeHapticFeedback.trigger("notificationError", {
          ignoreAndroidSystemSettings: true,
        })
        return
      }

      setPaymentError(
        errorsMessage || LL.SendBitcoinConfirmationScreen.somethingWentWrong(),
      )
      ReactNativeHapticFeedback.trigger("notificationError", {
        ignoreAndroidSystemSettings: true,
      })
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)

        const indempotencyErrorPattern = /409: Conflict/i
        if (indempotencyErrorPattern.test(err.message)) {
          setPaymentError(LL.SendBitcoinConfirmationScreen.paymentAlreadyAttempted())
          return
        }

        setPaymentError(err.message || err.toString())
      }
    }
  }, [
    LL,
    navigation,
    paymentDetail,
    sendPayment,
    setPaymentError,
    sendingWalletDescriptor?.currency,
    paymentType,
    destination,
    saveLnAddressContact,
    currencyAmount,
    satAmount,
    currencyFeeAmount,
    satFeeAmount,
  ])

  let validAmount = true
  let invalidAmountErrorMessage = ""

  const totalAmount = addMoneyAmounts({
    a: settlementAmount,
    b: fee.amount || ZeroUsdMoneyAmount,
  })

  if (
    moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Btc) &&
    btcBalanceMoneyAmount &&
    !isSendingMax
  ) {
    validAmount = lessThanOrEqualTo({
      value: totalAmount,
      lessThanOrEqualTo: btcBalanceMoneyAmount,
    })
    if (!validAmount) {
      invalidAmountErrorMessage = LL.SendBitcoinScreen.amountExceed({
        balance: hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText,
      })
    }
  }

  if (
    moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Usd) &&
    usdBalanceMoneyAmount &&
    !isSendingMax
  ) {
    validAmount = lessThanOrEqualTo({
      value: totalAmount,
      lessThanOrEqualTo: usdBalanceMoneyAmount,
    })
    if (!validAmount) {
      invalidAmountErrorMessage = LL.SendBitcoinScreen.amountExceed({
        balance: hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText,
      })
    }
  }

  const handleCopyToClipboard = () => {
    copyToClipboard({
      content: destination,
      message: LL.SendBitcoinConfirmationScreen.copiedDestination(),
    })
  }

  const errorMessage = paymentError || invalidAmountErrorMessage

  const transactionType = () => {
    if (paymentType === "intraledger") return LL.common.intraledger()
    if (paymentType === "onchain") return LL.common.onchain()
    if (paymentType === "lightning") return LL.common.lightning()
    if (paymentType === "lnurl") return LL.common.lightning()
  }

  const isLightningRecommended = () => {
    const ratioFeeToAmount = 50 // 2%

    if (!fee.amount) return false

    const feeMultiplied = multiplyMoneyAmounts({
      value: fee.amount,
      multiplier: ratioFeeToAmount,
    })

    if (
      paymentType === "onchain" &&
      greaterThan({ value: feeMultiplied, greaterThan: totalAmount })
    )
      return true
    return false
  }

  const LightningRecommendedComponent = isLightningRecommended() ? (
    <View style={styles.feeWarning}>
      <GaloyIcon name="warning" size={18} color={colors.warning} />
      <Text
        type="p3"
        style={styles.feeWarningText}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {" "}
        {LL.SendBitcoinConfirmationScreen.lightningRecommended()}
      </Text>
    </View>
  ) : (
    <></>
  )

  return (
    <Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader">
      <View style={styles.sendBitcoinConfirmationContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>
            {LL.SendBitcoinScreen.destination()} - {transactionType()}
          </Text>
          <View style={styles.fieldBackground}>
            <PaymentDestinationDisplay
              destination={destination}
              paymentType={paymentType}
            />
            <TouchableOpacity
              style={styles.iconContainer}
              onPress={handleCopyToClipboard}
              hitSlop={30}
            >
              <GaloyIcon name={"copy-paste"} size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>{LL.common.from()}</Text>
          <View style={styles.fieldBackground}>
            <View style={styles.walletSelectorTypeContainer}>
              <CurrencyPill
                currency={sendingWalletDescriptor.currency}
                containerSize="medium"
                containerStyle={pillWidthStyle}
                onLayout={onPillLayout(sendingWalletDescriptor.currency)}
              />
            </View>
            <View style={styles.walletSelectorInfoContainer}>
              <View style={styles.walletSelectorTypeTextContainer}>
                {sendingWalletDescriptor.currency === WalletCurrency.Btc ? (
                  <Text style={styles.walletCurrencyText}>
                    {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText}
                  </Text>
                ) : (
                  <Text style={styles.walletCurrencyText}>
                    {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText}
                  </Text>
                )}
              </View>
              <View style={styles.walletSelectorBalanceContainer}>
                {sendingWalletDescriptor.currency === WalletCurrency.Btc ? (
                  <Text>{hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcSecondaryText}</Text>
                ) : (
                  <Text>{hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdSecondaryText}</Text>
                )}
              </View>
              <View />
            </View>
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.amount()}</Text>
          <View style={styles.fieldBackground}>
            <Text type="p2">
              {formatDisplayAndWalletAmount({
                primaryAmount: unitOfAccountAmount,
                displayAmount,
                walletAmount: settlementAmount,
              })}
            </Text>
          </View>
        </View>
        {note ? (
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.note()}</Text>
            <View style={styles.fieldBackground}>
              <Text type="p2" style={styles.noteText}>
                {note}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.fieldContainer}>
          <View style={styles.feeTextContainer}>
            <Text style={styles.fieldTitleText}>
              {LL.SendBitcoinConfirmationScreen.feeLabel()}
            </Text>
            {LightningRecommendedComponent}
          </View>
          <View
            style={[
              styles.fieldBackground,
              isLightningRecommended() ? styles.warningOutline : undefined,
            ]}
          >
            {fee.status === "loading" && <ActivityIndicator />}
            {fee.status === "set" && (
              <Text type="p2" {...testProps("Successful Fee")}>
                {feeDisplayText}
              </Text>
            )}
            {fee.status === "error" && Boolean(fee.amount) && (
              <Text type="p2">{feeDisplayText} *</Text>
            )}
            {fee.status === "error" && !fee.amount && (
              <Text type="p2">{LL.SendBitcoinConfirmationScreen.feeError()}</Text>
            )}
          </View>
          {fee.status === "error" && Boolean(fee.amount) && (
            <Text type="p2" style={styles.maxFeeWarningText}>
              {"*" + LL.SendBitcoinConfirmationScreen.maxFeeSelected()}
            </Text>
          )}
        </View>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text type="p2" style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}
        <View style={styles.buttonContainer}>
          {/* disable slide gestures in area around the slider button */}
          <PanGestureHandler>
            <View style={styles.sliderContainer}>
              <GaloySliderButton
                isLoading={sendPaymentLoading}
                initialText={LL.SendBitcoinConfirmationScreen.slideToConfirm()}
                loadingText={LL.SendBitcoinConfirmationScreen.slideConfirming()}
                onSwipe={handleSendPayment}
                disabled={!validAmount || hasAttemptedSend}
              />
            </View>
          </PanGestureHandler>
        </View>
      </View>
    </Screen>
  )
}

export default SendBitcoinConfirmationScreen

const useStyles = makeStyles(({ colors }) => ({
  sendBitcoinConfirmationContainer: {
    flex: 1,
  },
  fieldContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  noteText: {
    flex: 1,
  },
  fieldBackground: {
    flexDirection: "row",
    borderStyle: "solid",
    overflow: "hidden",
    backgroundColor: colors.grey5,
    padding: 14,
    minHeight: 60,
    borderRadius: 10,
    alignItems: "center",
  },
  warningOutline: {
    borderColor: colors.warning,
    borderWidth: 2,
  },
  fieldTitleText: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  walletSelectorTypeContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
    marginRight: 28,
  },
  walletSelectorInfoContainer: {
    flex: 1,
    flexDirection: "column",
  },
  walletSelectorTypeTextContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  walletCurrencyText: {
    fontWeight: "bold",
    fontSize: 18,
  },
  walletSelectorBalanceContainer: {
    flex: 1,
    flexDirection: "row",
  },
  buttonContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  errorContainer: {
    marginVertical: 20,
    flex: 1,
  },
  errorText: {
    color: colors.error,
    textAlign: "center",
  },
  maxFeeWarningText: {
    color: colors.warning,
    fontWeight: "bold",
  },
  noteIconContainer: {
    marginRight: 12,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  noteIcon: {
    justifyContent: "center",
    alignItems: "center",
  },
  screenStyle: {
    paddingTop: 20,
    flexGrow: 1,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 20,
  },
  feeWarning: {
    paddingBottom: 4,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flex: 0.95,
  },
  feeWarningText: {
    color: colors.warning,
  },
  feeTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderContainer: {
    padding: 20,
  },
}))
