import React, { useState } from "react"
import { ScrollView, View } from "react-native"
import { PanGestureHandler } from "react-native-gesture-handler"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import { gql } from "@apollo/client"
import { Chip } from "@app/components/atomic/chip"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"
import { InfoSection } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { WarningBanner } from "@app/components/warning-banner"
import { Transaction, WalletCurrency } from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { isIdempotencyConflict } from "@app/graphql/is-idempotency-conflict"
import { useAppConfig, useClipboard, useDisplayCurrency } from "@app/hooks"
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
  ZeroBtcMoneyAmount,
  ZeroUsdMoneyAmount,
} from "@app/types/amounts"
import { useSendDustWarning, useTranslateSdkError } from "@app/self-custodial/hooks"
import { isSelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import { logPaymentAttempt, logPaymentResult } from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"
import { CommonActions, RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { SendWalletSummary } from "./amount-entry/send-wallet-summary"
import { isAmountFixableError } from "./amount-fixable-error"
import { formatEta } from "./fee-tier-options"
import { FeeTierOption } from "./hooks/fee-tiers.types"
import {
  CUSTODIAL_PAYOUT_ETA_MINUTES,
  feeTierFromPayoutSpeed,
} from "./hooks/use-custodial-onchain-fee-tiers"
import { useFeeTierLabels } from "./hooks/use-fee-tier-labels"
import { ETA_MINUTES } from "./hooks/use-onchain-fee-tiers"
import { SendReviewDestination } from "./review/send-review-destination"
import { SendHero } from "./send-hero"
import { useSendBalances } from "./hooks/use-send-wallets"
import { useVerifyPaymentSettled } from "./hooks/use-verify-payment-settled"
import { PaymentSendExtraInfo } from "./payment-details/index.types"
import useFee from "./use-fee"
import {
  IDEMPOTENCY_KEY_UNAVAILABLE,
  PaymentSendCompletedStatus,
  useSendPayment,
} from "./use-send-payment"
import { useSaveLnAddressContact } from "./use-save-lnaddress-contact"
import { formatDestination } from "./format-destination"

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
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "sendBitcoinConfirmation">
    >()

  const { paymentDetail } = route.params

  const { hideAmount } = useHideAmount()
  /** A tap on the wallet card shows the balance on this screen only: the global setting
   *  and the home screen's state stay as they are. */
  const [isBalanceRevealed, setIsBalanceRevealed] = useState(false)
  const isBalanceHidden = hideAmount && !isBalanceRevealed

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

  const { btcWallet, usdWallet } = useSendBalances()

  const btcBalanceMoneyAmount = toBtcMoneyAmount(btcWallet?.balance)

  const usdBalanceMoneyAmount = toUsdMoneyAmount(usdWallet?.balance)

  const btcPrimaryText = formatMoneyAmount({ moneyAmount: btcBalanceMoneyAmount })
  const usdPrimaryText = formatMoneyAmount({ moneyAmount: usdBalanceMoneyAmount })
  const [paymentFailure, setPaymentFailure] = useState<
    { message: string; canChangeAmount: boolean } | undefined
  >(undefined)
  const paymentError = paymentFailure?.message
  const setPaymentError = React.useCallback(
    (message: string, raw?: string) =>
      setPaymentFailure({ message, canChangeAmount: isAmountFixableError(raw) }),
    [],
  )
  const [isVerifying, setIsVerifying] = useState(false)
  const verifyPaymentSettled = useVerifyPaymentSettled()
  const { LL, locale } = useI18nContext()
  const translateSdkError = useTranslateSdkError()
  const { copyToClipboard } = useClipboard()
  const feeTierLabels = useFeeTierLabels()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const fee = useFee(getFee)

  const settledFee = fee.status === "set" ? fee : undefined

  const dustWarning = useSendDustWarning({
    amountAdjustment: settledFee?.amountAdjustment,
    fromCurrency: sendingWalletDescriptor.currency,
    fromWalletBalance: usdWallet?.balance,
    unitOfAccountAmount,
    settlementAmount: settlementAmount.amount,
    feeSats: settledFee?.amount.amount,
    usdBalanceMoneyAmount,
  })

  const feeUnavailable =
    fee.status === "loading" || (fee.status === "error" && !fee.amount)
  const dustNotEvaluable =
    dustWarning.status === "pending" || dustWarning.status === "blocked"
  // A blocked dust check stays a plain disable until #1273 N1 is ruled.
  const isCalculating = feeUnavailable || dustWarning.status === "pending"

  const progress = LL.SendBitcoinConfirmationScreen.sendProgress
  const sendProgressLabels = [
    progress.reviewing(),
    progress.signing(),
    progress.findingRoute(),
    progress.broadcasting(),
    progress.checkingDelivery(),
    progress.retrying(),
    progress.almostThere(),
    progress.anyTimeNow(),
    progress.ohOh(),
    progress.tryingAgain(),
  ]

  const defaultAmount = formatMoneyAmount({ moneyAmount: ZeroUsdMoneyAmount })
  let currencyFeeAmount = defaultAmount
  let satFeeAmount = defaultAmount

  const {
    loading: sendPaymentLoading,
    sendPayment,
    hasAttemptedSend,
  } = useSendPayment(sendPaymentMutation, paymentDetail.idempotencyKeyRef)

  // Self-custodial fee failures carry a classified SDK code; custodial ones carry raw
  // GraphQL text that is not fit to show, so only the former replaces the generic string.
  const feeErrorCode = fee.status === "error" ? fee.errors?.[0]?.message : undefined
  const feeErrorText =
    (isSelfCustodialErrorCode(feeErrorCode)
      ? translateSdkError(feeErrorCode)
      : undefined) ?? String(LL.common.feeError())
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

  const navigateToCompleted = React.useCallback(
    async ({
      status,
      extraInfo,
      transaction,
    }: {
      status: PaymentSendCompletedStatus
      extraInfo?: PaymentSendExtraInfo
      transaction?: Partial<Transaction> | null
    }) => {
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
              successAction: extraInfo?.successAction ?? paymentDetail?.successAction,
              preimage: extraInfo?.preimage,
              note,
              currencyAmount,
              satAmount,
              currencyFeeAmount,
              satFeeAmount,
              destination: formatDestination({
                destination,
                paymentType,
                lnAddressHostname,
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
    },
    [
      saveLnAddressContact,
      navigation,
      paymentType,
      destination,
      lnAddressHostname,
      paymentDetail,
      note,
      currencyAmount,
      satAmount,
      currencyFeeAmount,
      satFeeAmount,
    ],
  )

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
        await navigateToCompleted({ status, extraInfo, transaction })
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
        translateSdkError(errorsMessage) ||
          LL.SendBitcoinConfirmationScreen.somethingWentWrong(),
        errorsMessage,
      )
      ReactNativeHapticFeedback.trigger("notificationError", {
        ignoreAndroidSystemSettings: true,
      })
    } catch (err) {
      if (err instanceof Error) {
        reportError("send-bitcoin-confirmation", err)

        if (isIdempotencyConflict(err)) {
          // The server already processed a first attempt of this payment, so it may well
          // have succeeded — check the ledger before claiming failure.
          const paymentRequest =
            paymentDetail.paymentType === "lightning"
              ? destination
              : paymentDetail.paymentType === "lnurl"
                ? paymentDetail.paymentRequest
                : undefined

          if (paymentRequest) {
            setIsVerifying(true)
            let verified
            try {
              verified = await verifyPaymentSettled({
                walletId: sendingWalletDescriptor.id,
                paymentRequest,
              })
            } finally {
              setIsVerifying(false)
            }
            if (verified) {
              logPaymentResult({
                paymentType: paymentDetail.paymentType,
                paymentStatus: verified.status,
                sendingWallet: sendingWalletDescriptor.currency,
              })
              await navigateToCompleted({
                status: verified.status,
                transaction: { createdAt: verified.createdAt },
              })
              return
            }
          }

          setPaymentError(LL.SendBitcoinConfirmationScreen.paymentAlreadyAttempted())
          ReactNativeHapticFeedback.trigger("notificationError", {
            ignoreAndroidSystemSettings: true,
          })
          return
        }

        setPaymentError(
          err.message === IDEMPOTENCY_KEY_UNAVAILABLE
            ? LL.SendBitcoinConfirmationScreen.somethingWentWrong()
            : err.message || err.toString(),
          err.message,
        )
      }
    }
  }, [
    LL,
    paymentDetail,
    sendPayment,
    setPaymentError,
    sendingWalletDescriptor,
    destination,
    navigateToCompleted,
    verifyPaymentSettled,
    translateSdkError,
  ])

  let validAmount = true
  let invalidAmountErrorMessage = ""

  const zeroSettlementAmount = moneyAmountIsCurrencyType(
    settlementAmount,
    WalletCurrency.Btc,
  )
    ? ZeroBtcMoneyAmount
    : ZeroUsdMoneyAmount

  const feeInSettlementCurrency = fee.amount
    ? paymentDetail.convertMoneyAmount(fee.amount, settlementAmount.currency)
    : zeroSettlementAmount

  const totalAmount = addMoneyAmounts({
    a: settlementAmount,
    b: feeInSettlementCurrency,
  })

  const skipBalanceCheck = isSendingMax || hasAttemptedSend

  if (
    moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Btc) &&
    btcBalanceMoneyAmount &&
    !skipBalanceCheck
  ) {
    validAmount = lessThanOrEqualTo({
      value: totalAmount,
      lessThanOrEqualTo: btcBalanceMoneyAmount,
    })
    if (!validAmount) {
      invalidAmountErrorMessage = LL.SendBitcoinConfirmationScreen.totalExceed({
        balance: btcPrimaryText,
      })
    }
  }

  if (
    moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Usd) &&
    usdBalanceMoneyAmount &&
    !skipBalanceCheck
  ) {
    validAmount = lessThanOrEqualTo({
      value: totalAmount,
      lessThanOrEqualTo: usdBalanceMoneyAmount,
    })
    if (!validAmount) {
      invalidAmountErrorMessage = LL.SendBitcoinConfirmationScreen.totalExceed({
        balance: usdPrimaryText,
      })
    }
  }

  const handleCopyToClipboard = () => {
    copyToClipboard({
      content: destination,
      message: LL.SendBitcoinConfirmationScreen.copiedDestination(),
    })
  }

  const isLightningRecommended = (() => {
    const ratioFeeToAmount = 50 // 2%

    if (!fee.amount || paymentType !== "onchain") return false

    const feeMultiplied = multiplyMoneyAmounts({
      value: fee.amount,
      multiplier: ratioFeeToAmount,
    })

    return greaterThan({ value: feeMultiplied, greaterThan: totalAmount })
  })()

  const sendingWalletBalance =
    sendingWalletDescriptor.currency === WalletCurrency.Btc
      ? btcBalanceMoneyAmount
      : usdBalanceMoneyAmount
  const walletBalanceSecondary = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: sendingWalletBalance,
    walletAmount: sendingWalletBalance,
    displayAmount: convertMoneyAmount(sendingWalletBalance, DisplayCurrency),
  })

  /** Custodial sends carry the payout speed, self-custodial ones the SDK tier; each rail
   *  has its own broadcast windows. */
  const priorityTier: FeeTierOption | undefined =
    paymentType === "onchain"
      ? paymentDetail.feeTier ?? feeTierFromPayoutSpeed(paymentDetail.payoutSpeed)
      : undefined
  const priorityEtaMinutes =
    priorityTier &&
    (paymentDetail.feeTier ? ETA_MINUTES : CUSTODIAL_PAYOUT_ETA_MINUTES)[priorityTier]

  const isFeeLoading = fee.status === "loading" || fee.status === "unset"
  const isMaxFee = fee.status === "error" && Boolean(fee.amount)
  const isFeeFailed = fee.status === "error" && !fee.amount

  // A failed quote leaves the row blank; its reason goes under the card with the other errors.
  const feeValue = isFeeFailed ? "—" : `${feeDisplayText}${isMaxFee ? " *" : ""}`

  const detailItems = [
    ...(priorityTier && priorityEtaMinutes !== undefined
      ? [
          {
            label: LL.SendBitcoinScreen.feeTier(),
            value: `${feeTierLabels[priorityTier]} ~ ${formatEta(priorityEtaMinutes, locale)}`,
          },
        ]
      : []),
    {
      label: LL.SendBitcoinConfirmationScreen.feeLabel(),
      value: feeValue,
      loading: isFeeLoading,
      valueTestId: fee.status === "set" ? "Successful Fee" : undefined,
    },
    ...(note ? [{ label: LL.common.note(), value: note }] : []),
  ]

  /** One slot under the card, first match wins: what blocks the send (red) before the
   *  high-fee advisory (warning). */
  const blockingError =
    paymentError || invalidAmountErrorMessage || (isFeeFailed ? feeErrorText : "")
  // Offered only when the error on show is about the amount; a network or invoice failure
  // is not fixed by going back to change it.
  const canChangeAmount = paymentFailure
    ? paymentFailure.canChangeAmount
    : Boolean(invalidAmountErrorMessage) ||
      (isFeeFailed && isAmountFixableError(feeErrorCode))
  const detailsOutline =
    invalidAmountErrorMessage || isFeeFailed
      ? colors.error
      : isLightningRecommended
        ? colors.warning
        : undefined

  return (
    <Screen preset="fixed" keyboardOffset="navigationHeader">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SendHero
          caption={LL.SendBitcoinConfirmationScreen.sending()}
          primaryAmount={currencyAmount}
          secondaryAmount={secondaryAmount ? satAmount : undefined}
        />
        <SendReviewDestination
          destination={destination}
          paymentType={paymentType}
          onCopy={handleCopyToClipboard}
        />
        <View style={styles.group}>
          <Text type="p3">{LL.SendBitcoinConfirmationScreen.fromBalance()}</Text>
          <SendWalletSummary
            inactive
            currency={sendingWalletDescriptor.currency}
            isBalanceHidden={isBalanceHidden}
            onReveal={isBalanceHidden ? () => setIsBalanceRevealed(true) : undefined}
            balancePrimary={formatMoneyAmount({ moneyAmount: sendingWalletBalance })}
            balanceSecondary={
              walletBalanceSecondary &&
              formatMoneyAmount({
                moneyAmount: walletBalanceSecondary,
                isApproximate: true,
              })
            }
          />
        </View>
        <View style={styles.group}>
          <InfoSection
            title={LL.SendBitcoinConfirmationScreen.details()}
            items={detailItems}
            outlineColor={detailsOutline}
            inactive
          />
          {blockingError ? (
            <View style={styles.errorWithAction}>
              <GaloyErrorBox errorMessage={blockingError} filled={false} />
              {canChangeAmount ? (
                <Chip
                  label={LL.SendBitcoinConfirmationScreen.changeAmount()}
                  onPress={() => navigation.goBack()}
                  style={styles.changeAmountChip}
                />
              ) : null}
            </View>
          ) : isLightningRecommended ? (
            <WarningBanner>
              {LL.SendBitcoinConfirmationScreen.lightningRecommended()}
            </WarningBanner>
          ) : null}
          {isMaxFee ? (
            <Text type="p3" style={styles.footnote}>
              {"*" + LL.SendBitcoinConfirmationScreen.maxFeeSelected()}
            </Text>
          ) : null}
          {dustWarning.status === "visible" ? (
            <WarningBanner>
              {LL.SendBitcoinConfirmationScreen.usdRemainderSweep({
                remaining: formatMoneyAmount({ moneyAmount: dustWarning.remaining }),
                remainingSats: formatMoneyAmount({
                  moneyAmount: dustWarning.remainingSats,
                }),
                minimum: formatMoneyAmount({ moneyAmount: dustWarning.minimum }),
              })}
            </WarningBanner>
          ) : null}
        </View>
      </ScrollView>
      {/* disable slide gestures in area around the slider button */}
      <PanGestureHandler>
        <View style={styles.sliderContainer}>
          <GaloySliderButton
            isLoading={sendPaymentLoading || isVerifying}
            initialText={LL.SendBitcoinConfirmationScreen.slideToSend()}
            loadingText={LL.SendBitcoinConfirmationScreen.sendProgress.reviewing()}
            busyLabels={sendProgressLabels}
            disabledText={
              isCalculating
                ? LL.SendBitcoinConfirmationScreen.calculatingFee()
                : undefined
            }
            accentColor={
              sendingWalletDescriptor.currency === WalletCurrency.Usd
                ? colors._green
                : colors.primary
            }
            onSwipe={handleSendPayment}
            disabled={!validAmount || !sendPayment || feeUnavailable || dustNotEvaluable}
          />
        </View>
      </PanGestureHandler>
    </Screen>
  )
}

export default SendBitcoinConfirmationScreen

const useStyles = makeStyles(({ colors }) => ({
  scroll: {
    flex: 1,
  },
  /** Figma's body column: 14 between blocks, 20 at the sides, 10 under the header. */
  scrollContent: {
    rowGap: 14,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  group: {
    rowGap: 7,
  },
  errorWithAction: {
    rowGap: 12,
  },
  changeAmountChip: {
    alignSelf: "center",
  },
  footnote: {
    color: colors.grey2,
  },
  sliderContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
}))
