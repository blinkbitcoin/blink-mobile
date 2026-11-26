import React, { useMemo, useState } from "react"
import { Platform, ScrollView, View } from "react-native"
import { PanGestureHandler } from "react-native-gesture-handler"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import Animated from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { gql } from "@apollo/client"
import { Chip } from "@app/components/atomic/chip"
import { HeaderBackButtonWithTheme } from "@app/components/header-back-control/header-back-control"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"
import { InfoSection } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { SuccessGlow } from "@app/components/success-glow"
import { WarningBanner } from "@app/components/warning-banner"
import { PreferredAmountCurrency } from "@app/graphql/client-only-query"
import {
  Transaction,
  usePreferredAmountCurrencyQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { isIdempotencyConflict } from "@app/graphql/is-idempotency-conflict"
import { useClipboard, useDisplayCurrency } from "@app/hooks"
import { useAccessibilityAnnouncement } from "@app/hooks/use-accessibility-announcement"
import { useInitialAccessibilityFocus } from "@app/hooks/use-initial-accessibility-focus"
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
import { logPaymentAttempt, logPaymentResult } from "@app/utils/analytics"
import { groupTitleGap } from "@app/rne-theme/tokens"
import { reportError } from "@app/utils/error-logging"
import { CommonActions, RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { SendWalletSummary } from "./amount-entry/send-wallet-summary"
import { isAmountFixableError } from "./amount-fixable-error"
import { feeTierLabels, formatEta } from "./fee-tier-options"
import { FeeTierOption } from "@app/types/fee-tiers"
import { useHomeOnBackAfterSend } from "./hooks/use-home-on-back-after-send"
import {
  CUSTODIAL_PAYOUT_ETA_MINUTES,
  feeTierFromPayoutSpeed,
} from "./hooks/use-custodial-onchain-fee-tiers"
import { ETA_MINUTES } from "./hooks/use-onchain-fee-tiers"
import { SendReviewDestination } from "./review/send-review-destination"
import { useSentTransition } from "./review/use-sent-transition"
import { useSettledSendHold } from "./settled-send-hold"
import { SendHero } from "./send-hero"
import { useSendBalances } from "./hooks/use-send-wallets"
import { useVerifyPaymentSettled } from "./hooks/use-verify-payment-settled"
import { PaymentSendExtraInfo } from "./payment-details/index.types"
import { useReviewFeeText } from "./review/use-review-fee-text"
import useFee from "./use-fee"
import { PaymentErrorActions } from "./payment-error-actions"
import {
  IDEMPOTENCY_KEY_UNAVAILABLE,
  PaymentSendCompletedStatus,
  useSendPayment,
} from "./use-send-payment"
import { useSaveLnAddressContact } from "./use-save-lnaddress-contact"

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

  /** Screen reader focus starts on slide to send, the step review leads to; while the fee
   *  is still being worked out, the handle reads as calculating. */
  const sliderHandleRef = React.useRef<View>(null)
  const isBalanceHidden = hideAmount && !isBalanceRevealed

  const {
    destination,
    paymentType,
    sendingWalletDescriptor,
    sendPaymentMutation,
    settlementAmount,
    memo: note,
    unitOfAccountAmount,
    convertMoneyAmount,
    isSendingMax,
  } = paymentDetail

  const { getSecondaryAmountIfCurrencyIsDifferent, formatMoneyAmount } =
    useDisplayCurrency()
  const saveLnAddressContact = useSaveLnAddressContact()

  /** A typed amount reads back in the currency the sender last swapped the keypad to; a
   *  fixed amount leads with the display currency, as amount entry does. */
  const { data: preferredData } = usePreferredAmountCurrencyQuery()
  const leadsWithWalletCurrency =
    paymentDetail.canSetAmount &&
    preferredData?.preferredAmountCurrency === PreferredAmountCurrency.Default

  const { btcWallet, usdWallet } = useSendBalances()

  const btcBalanceMoneyAmount = toBtcMoneyAmount(btcWallet?.balance)

  const usdBalanceMoneyAmount = toUsdMoneyAmount(usdWallet?.balance)

  const btcPrimaryText = formatMoneyAmount({ moneyAmount: btcBalanceMoneyAmount })
  const usdPrimaryText = formatMoneyAmount({ moneyAmount: usdBalanceMoneyAmount })
  const [paymentError, setPaymentError] = useState<string | undefined>(undefined)
  /** What the last send that did not go out said about itself, for the actions it
   *  offers under its error. */
  const [failedSend, setFailedSend] = useState<PaymentSendExtraInfo | undefined>(
    undefined,
  )
  const clearPaymentError = React.useCallback(() => {
    setPaymentError(undefined)
    setFailedSend(undefined)
  }, [])
  const [isVerifying, setIsVerifying] = useState(false)
  const verifyPaymentSettled = useVerifyPaymentSettled()
  const { LL, locale } = useI18nContext()
  const translateSdkError = useTranslateSdkError()
  const { copyToClipboard } = useClipboard()
  const tierLabels = feeTierLabels(LL)

  const fee = useFee(paymentDetail.getFee)

  /** The receipt a landed payment opens from Sent, kept until the sender asks for it. */
  const sentReceiptRef =
    React.useRef<RootStackParamList["sendBitcoinCompleted"]>(undefined)
  /** False once review has unmounted, so a success that resolves after that never
   *  writes into an unmounted Sent. */
  const isMountedRef = React.useRef(false)
  const { hold: holdSettledSend, isRouteLive } = useSettledSendHold()

  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const resetToCompleted = React.useCallback(
    (params: RootStackParamList["sendBitcoinCompleted"]) =>
      navigation.dispatch((state) => {
        const routes = [{ name: "Primary" }, { name: "sendBitcoinCompleted", params }]
        return CommonActions.reset({
          ...state,
          routes,
          index: routes.length - 1,
        })
      }),
    [navigation],
  )

  const handleOpenReceipt = React.useCallback(() => {
    if (sentReceiptRef.current) resetToCompleted(sentReceiptRef.current)
  }, [resetToCompleted])

  /** Sent hands over to the receipt on its own once it has held long enough. */
  const sentTransition = useSentTransition({ onHoldEnd: handleOpenReceipt })
  /** Review is headerless and runs edge to edge, so the Sent glow can fill the whole
   *  screen; the stage pads the content back clear of the system bars. */
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets()

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
  const isCalculating = fee.status === "loading" || dustWarning.status === "pending"
  // A failed quote says so, matching the fee row, instead of implying a wait will help.
  let sliderDisabledText: string | undefined
  if (isCalculating)
    sliderDisabledText = LL.SendBitcoinConfirmationScreen.calculatingFee()
  else if (fee.status === "error" && !fee.amount)
    sliderDisabledText = LL.common.feeError()

  /* One label every LABEL_INTERVAL_MS (3 s), holding on the last for as long as the send
   * takes: Reviewing 0 s, Signing 3 s, Finding route 6 s, Broadcasting 9 s, Checking
   * delivery 12 s, Almost there 15 s, Any time now 18 s, Hang tight 21 s, Still on its way
   * from 24 s. Product ruling: one script for every rail; an intraledger send settles in
   * about a second, before the routing labels show. */
  const sendProgressLabels = useMemo(() => {
    const progress = LL.SendBitcoinConfirmationScreen.sendProgress
    return [
      progress.reviewing(),
      progress.signing(),
      progress.findingRoute(),
      progress.broadcasting(),
      progress.checkingDelivery(),
      progress.almostThere(),
      progress.anyTimeNow(),
      progress.hangTight(),
      progress.stillOnItsWay(),
    ]
  }, [LL])

  const { feeDisplayText, currencyFeeAmount, satFeeAmount, feeErrorCode, feeErrorText } =
    useReviewFeeText({ fee, paymentDetail, leadsWithWalletCurrency })

  const {
    loading: sendPaymentLoading,
    sendPayment,
    hasAttemptedSend,
  } = useSendPayment(sendPaymentMutation, paymentDetail.idempotencyKeyRef)
  // Once Sent takes over, its own hold owns back.
  useHomeOnBackAfterSend(hasAttemptedSend && !sentTransition.isSettled)

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

  /** The hero pairs the display currency with the sending wallet's, the pair the keypad
   *  swaps between, led by whichever the sender typed in. */
  const heroWalletAmount = paymentDetail.convertMoneyAmount(
    settlementAmount,
    sendingWalletDescriptor.currency,
  )
  const heroPrimaryAmount = leadsWithWalletCurrency ? heroWalletAmount : displayAmount
  const heroSecondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: heroPrimaryAmount,
    walletAmount: heroWalletAmount,
    displayAmount,
  })
  const heroPrimaryText = formatMoneyAmount({ moneyAmount: heroPrimaryAmount })
  const heroSecondaryText =
    heroSecondaryAmount && formatMoneyAmount({ moneyAmount: heroSecondaryAmount })

  const {
    stageRef,
    heroRef,
    isSent,
    sentPlay,
    isAtEnd,
    glowFrame,
    heroProgress,
    glowProgress,
    detailsStyle,
    goneWhenSent,
    heroStyle,
    actionsStyle,
    areActionsLive,
    playSent,
  } = sentTransition

  /** Read each time review regains focus: once Sent has played the slider is hidden, so a
   *  return from the lock screen leaves focus to the screen reader instead of sending it
   *  to a control nobody can see. */
  useInitialAccessibilityFocus(isSent ? undefined : sliderHandleRef)

  /** Review turns into Sent in place, with no new screen to land focus on, so the result
   *  is spoken as Sent appears, also when it first appears on the sender's return. */
  useAccessibilityAnnouncement(
    sentPlay
      ? LL.SendBitcoinConfirmationScreen.sentAnnouncement({ amount: heroPrimaryText })
      : undefined,
  )

  const handleClose = React.useCallback(() => navigation.popToTop(), [navigation])

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
      /** Started only once the outcome is on screen and never awaited by the send: a
       *  contact that fails to save must not read as a payment that failed. */
      const saveContact = () => {
        saveLnAddressContact({
          paymentType,
          destination,
          isMerchant:
            paymentDetail.paymentType === "lnurl" ? paymentDetail.isMerchant : undefined,
        }).catch((err) => reportError("send-bitcoin-confirmation:save-contact", err))
      }

      const isSuccess = status === "SUCCESS"
      const params: RootStackParamList["sendBitcoinCompleted"] = {
        arrivalAtMempoolEstimate: extraInfo?.arrivalAtMempoolEstimate,
        status,
        successAction: extraInfo?.successAction ?? paymentDetail?.successAction,
        preimage: extraInfo?.preimage ?? undefined,
        note,
        currencyAmount,
        satAmount,
        currencyFeeAmount,
        satFeeAmount,
        destination,
        paymentType: paymentDetail?.paymentType,
        createdAt: transaction?.createdAt,
        hasShownSuccess: isSuccess,
      }

      /** A payment that landed plays Sent in place and holds there until the sender opens
       *  the receipt or closes; the receipt then skips its own success icon. Pending keeps
       *  today's screen until its design lands. */
      if (isSuccess) {
        ReactNativeHapticFeedback.trigger("notificationSuccess", {
          ignoreAndroidSystemSettings: true,
        })
        saveContact()
        /** PaymentSucceeded refreshes the wallet, and a failed refresh marks it offline.
         *  The gate would then unmount Sent and drop the receipt timer, so the hold is
         *  taken before this function yields. If the gate already won, open the receipt
         *  now: the payment landed either way. If the sender left instead, the route is
         *  gone with it, and their new place in the app stays as it is. */
        if (!isMountedRef.current) {
          if (isRouteLive()) resetToCompleted({ ...params, hasShownSuccess: false })
          return
        }
        holdSettledSend()
        sentReceiptRef.current = params
        await playSent({
          primaryAmount: heroPrimaryText,
          hasSecondaryAmount: Boolean(heroSecondaryText),
        })
        return
      }

      /** Pending is not a success: no success haptic, and no Sent. */
      resetToCompleted(params)
      saveContact()
    },
    [
      playSent,
      resetToCompleted,
      holdSettledSend,
      isRouteLive,
      heroPrimaryText,
      heroSecondaryText,
      saveLnAddressContact,
      paymentType,
      destination,
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

    setFailedSend(undefined)
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

      setFailedSend(extraInfo)
      setPaymentError(
        translateSdkError(errorsMessage) ||
          LL.SendBitcoinConfirmationScreen.somethingWentWrong(),
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

  /** The sender checked their history and chose to send anyway: the destination was
   *  released, so the send goes out now, as the button says. */
  const sendAgainAnyway = React.useCallback(() => {
    clearPaymentError()
    handleSendPayment()
  }, [clearPaymentError, handleSendPayment])

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

  const handleCopyToClipboard = (shown: string) => {
    copyToClipboard({
      content: shown,
      message: LL.SendBitcoinConfirmationScreen.copiedDestination(),
    })
  }

  /** What stops a send from this screen: the slider's gates, which "send anyway" honours
   *  too, since it sends in the slider's place. */
  const isSliderDisabled =
    !validAmount || !sendPayment || feeUnavailable || dustNotEvaluable

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
            value: `${tierLabels[priorityTier]} ~ ${formatEta(priorityEtaMinutes, locale)}`,
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
  // is not fixed by going back to change it. Never after a send attempt: back goes Home
  // from then on (useHomeOnBackAfterSend), and an amount code on a send is the SDK's word
  // that nothing went out, not a certainty.
  const canChangeAmount =
    !hasAttemptedSend &&
    !paymentError &&
    (Boolean(invalidAmountErrorMessage) ||
      (isFeeFailed && isAmountFixableError(feeErrorCode)))
  const detailsOutline =
    invalidAmountErrorMessage || isFeeFailed
      ? colors.error
      : isLightningRecommended
        ? colors.warning
        : undefined

  return (
    <Screen preset="fixed" edges={["left", "right"]}>
      <View
        ref={stageRef}
        style={[styles.stage, { paddingTop: topInset, paddingBottom: bottomInset }]}
        collapsable={false}
      >
        {glowFrame ? <SuccessGlow progress={glowProgress} {...glowFrame} /> : null}
        {/* The header row stands in for the native header and dissolves with the details. */}
        <Animated.View
          style={[styles.headerRow, detailsStyle]}
          pointerEvents={isSent ? "none" : "auto"}
          {...goneWhenSent}
        >
          <HeaderBackButtonWithTheme />
        </Animated.View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={!isSent}
        >
          <View style={styles.hero}>
            <Animated.View ref={heroRef} style={heroStyle} collapsable={false}>
              <SendHero
                caption={
                  isSent
                    ? LL.SendBitcoinConfirmationScreen.sent()
                    : LL.SendBitcoinConfirmationScreen.sending()
                }
                primaryAmount={heroPrimaryText}
                secondaryAmount={heroSecondaryText}
                sentProgress={heroProgress}
                isSent={isSent}
                sentPlay={sentPlay}
                isSentAtEnd={isAtEnd}
              />
            </Animated.View>
          </View>
          <Animated.View
            style={[styles.details, detailsStyle]}
            pointerEvents={isSent ? "none" : "auto"}
            {...goneWhenSent}
          >
            <SendReviewDestination
              destination={destination}
              paymentType={paymentType}
              onCopy={handleCopyToClipboard}
            />
            <View>
              <Text type="p3" style={styles.fieldTitleText}>
                {LL.SendBitcoinConfirmationScreen.fromBalance()}
              </Text>
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
              />
              {blockingError ? (
                <View style={styles.errorWithAction}>
                  <GaloyErrorBox errorMessage={blockingError} filled={false} announce />
                  {canChangeAmount ? (
                    <Chip
                      label={LL.SendBitcoinConfirmationScreen.changeAmount()}
                      onPress={() => navigation.goBack()}
                      style={styles.changeAmountChip}
                    />
                  ) : null}
                </View>
              ) : isLightningRecommended ? (
                <WarningBanner announce>
                  {LL.SendBitcoinConfirmationScreen.lightningRecommended()}
                </WarningBanner>
              ) : null}
              {isMaxFee ? (
                <Text type="p3" style={styles.footnote}>
                  {"*" + LL.SendBitcoinConfirmationScreen.maxFeeSelected()}
                </Text>
              ) : null}
              {dustWarning.status === "visible" ? (
                <WarningBanner announce>
                  {LL.SendBitcoinConfirmationScreen.usdRemainderSweep({
                    remaining: formatMoneyAmount({ moneyAmount: dustWarning.remaining }),
                    remainingSats: formatMoneyAmount({
                      moneyAmount: dustWarning.remainingSats,
                    }),
                    minimum: formatMoneyAmount({ moneyAmount: dustWarning.minimum }),
                  })}
                </WarningBanner>
              ) : null}
              <PaymentErrorActions
                failedSend={failedSend}
                canSendAnyway={!isSliderDisabled}
                onSendAnyway={sendAgainAnyway}
              />
            </View>
          </Animated.View>
        </ScrollView>
        {/* disable slide gestures in area around the slider button */}
        <PanGestureHandler>
          <Animated.View
            style={[styles.sliderContainer, detailsStyle]}
            pointerEvents={isSent ? "none" : "auto"}
            {...goneWhenSent}
          >
            <GaloySliderButton
              isLoading={sendPaymentLoading || isVerifying}
              initialText={LL.SendBitcoinConfirmationScreen.slideToSend()}
              loadingText={LL.SendBitcoinConfirmationScreen.sendProgress.reviewing()}
              busyLabels={sendProgressLabels}
              disabledText={sliderDisabledText}
              accentColor={
                sendingWalletDescriptor.currency === WalletCurrency.Usd
                  ? colors.success
                  : colors.accent
              }
              onSwipe={handleSendPayment}
              handleRef={sliderHandleRef}
              disabled={isSliderDisabled}
            />
          </Animated.View>
        </PanGestureHandler>
        {isSent ? (
          <Animated.View
            style={[styles.sentActions, { bottom: bottomInset }, actionsStyle]}
            testID="sent-actions"
            pointerEvents={areActionsLive ? "auto" : "none"}
            accessibilityElementsHidden={!areActionsLive}
            importantForAccessibility={areActionsLive ? "auto" : "no-hide-descendants"}
          >
            <GaloyPrimaryButton
              title={LL.SendBitcoinConfirmationScreen.receipt()}
              onPress={handleOpenReceipt}
            />
            <GaloySecondaryButton title={LL.common.close()} onPress={handleClose} />
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  )
}

export default SendBitcoinConfirmationScreen

const useStyles = makeStyles(({ colors }) => ({
  /** The whole screen, header and system bars included; clips the glow as it blooms past
   *  the edges. */
  stage: {
    flex: 1,
    overflow: "hidden",
  },
  /** Matches the native header it replaces: 56 high on Android, 44 on iOS, with the
   *  native leading inset the back button's own correction expects. */
  headerRow: {
    height: Platform.OS === "android" ? 56 : 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Platform.OS === "android" ? 16 : 8,
  },
  scroll: {
    flex: 1,
  },
  /** Figma's body column: 14 between blocks, 20 at the sides, the hero flush with the
   *  header. */
  scrollContent: {
    rowGap: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  /** Holds the amounts 10 further off the destination than the blocks below sit apart. */
  hero: {
    paddingBottom: 10,
  },
  /** Everything under the hero, which dissolves as one once the payment lands. */
  details: {
    rowGap: 14,
  },
  /** A title above a card, as on the Destination field and the Details card. */
  fieldTitleText: {
    color: colors.textSecondary,
    marginBottom: groupTitleGap,
  },
  /** The Details card and the notices under it. */
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
    color: colors.textMuted,
  },
  sliderContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  /** Figma's button group, laid over the slot the slider dissolves out of. */
  sentActions: {
    position: "absolute",
    left: 0,
    right: 0,
    rowGap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
}))
