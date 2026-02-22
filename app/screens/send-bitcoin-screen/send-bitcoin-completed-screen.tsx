import React, { useCallback, useEffect, useRef, useState } from "react"
import { View, Alert, ScrollView } from "react-native"
import InAppReview from "react-native-in-app-review"
import ViewShot from "react-native-view-shot"

import { useApolloClient } from "@apollo/client"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import {
  CompletedTextAnimation,
  SuccessIconAnimation,
} from "@app/components/success-animation"
import { SuccessActionComponent } from "@app/components/success-action"
import { setFeedbackModalShown } from "@app/graphql/client-only-query"
import {
  useFeedbackModalShownQuery,
  useSettingsScreenQuery,
} from "@app/graphql/generated"
import { useAppConfig, useScreenshot } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logAppFeedback } from "@app/utils/analytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import { SuggestionModal } from "./suggestion-modal"
import { PaymentSendCompletedStatus } from "./use-send-payment"
import LogoLightMode from "@app/assets/logo/blink-logo-light.svg"
import LogoDarkMode from "@app/assets/logo/app-logo-dark.svg"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SuccessActionTag } from "@app/components/success-action/success-action"
import { LNURLPaySuccessAction, utils } from "lnurl-pay"
import { formatUnixTimestampYMDHM } from "@app/utils/date"
import {
  formatTimeToMempool,
  timeToMempool,
} from "../transaction-detail-screen/format-time"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyInstance } from "@app/config/galoy-instances"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { PaymentType } from "@blinkbitcoin/blink-client"

type StatusProcessed = "SUCCESS" | "PENDING" | "QUEUED"

interface Props {
  route: RouteProp<RootStackParamList, "sendBitcoinCompleted">
}

const FEEDBACK_DELAY = 3000

const processStatus = ({
  status,
  arrivalAtMempoolEstimate,
}: {
  status: PaymentSendCompletedStatus
  arrivalAtMempoolEstimate: number | undefined
}): StatusProcessed => {
  if (status === "SUCCESS") return "SUCCESS"
  return arrivalAtMempoolEstimate ? "QUEUED" : "PENDING"
}

const formatPaymentType = ({
  blinkToBlinkLabel,
  paymentType,
}: {
  blinkToBlinkLabel: string
  paymentType?: PaymentType | string
}): string => {
  return paymentType === PaymentType.Intraledger ? blinkToBlinkLabel : paymentType ?? ""
}

const useSuccessMessage = (
  successAction?: LNURLPaySuccessAction,
  preimage?: string,
): string => {
  return useCallback(() => {
    if (!successAction) return ""

    const { tag, message, description, url } = successAction
    const decryptedMessage =
      tag === SuccessActionTag.AES && preimage
        ? utils.decipherAES({ successAction, preimage })
        : null

    const textContent = [message, description, decryptedMessage].filter(Boolean).join(" ")
    const includeUrl = url && !textContent.includes(url)

    return includeUrl ? `${textContent} ${url}`.trim() : textContent
  }, [successAction, preimage])()
}

const useFeedbackHandler = () => {
  const client = useApolloClient()
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)

  const handleNegativeFeedback = useCallback(() => {
    logAppFeedback({ isEnjoingApp: false })
    setShowSuggestionModal(true)
  }, [])

  const handlePositiveFeedback = useCallback(() => {
    logAppFeedback({ isEnjoingApp: true })
    InAppReview.RequestInAppReview()
  }, [])

  const requestFeedback = useCallback(() => {
    if (!shouldShowFeedback(appConfig)) return

    if (InAppReview.isAvailable()) {
      showFeedbackAlert(LL, handleNegativeFeedback, handlePositiveFeedback)
      setFeedbackModalShown(client, true)
    }
  }, [LL, client, appConfig, handleNegativeFeedback, handlePositiveFeedback])

  return { requestFeedback, showSuggestionModal, setShowSuggestionModal }
}

const shouldShowFeedback = (appConfig: {
  token: string
  galoyInstance: GaloyInstance
}): boolean => {
  return appConfig && appConfig.galoyInstance.id !== "Local"
}

const showFeedbackAlert = (
  LL: TranslationFunctions,
  onNegative: () => void,
  onPositive: () => void,
) => {
  Alert.alert(
    "",
    LL.support.enjoyingApp(),
    [
      { text: LL.common.No(), onPress: onNegative },
      { text: LL.common.yes(), onPress: onPositive },
    ],
    { cancelable: true },
  )
}

const SuccessIconComponent: React.FC<{
  status: StatusProcessed
  arrivalAtMempoolEstimate: number | undefined
}> = ({ status, arrivalAtMempoolEstimate }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()

  const getStatusIcon = () => {
    const iconMap = {
      SUCCESS: () => <GaloyIcon name="payment-success" size={100} />,
      QUEUED: () => <GaloyIcon name="payment-pending" size={100} />,
      PENDING: () => <GaloyIcon name="warning" color={colors._orange} size={100} />,
    }
    return iconMap[status]()
  }

  const getStatusText = () => {
    const textMap = {
      SUCCESS: () => LL.SendBitcoinScreen.success(),
      QUEUED: () =>
        LL.TransactionDetailScreen.txNotBroadcast({
          countdown: formatTimeToMempool(
            timeToMempool(arrivalAtMempoolEstimate as number),
            LL,
            locale,
          ),
        }),
      PENDING: () => LL.SendBitcoinScreen.pendingPayment(),
    }
    return textMap[status]()
  }

  return (
    <View style={styles.successViewContainer} {...testProps("Success Text")}>
      <SuccessIconAnimation>{getStatusIcon()}</SuccessIconAnimation>
      <CompletedTextAnimation>
        <Text style={styles.completedText} {...testProps(status)} type={"p2"}>
          {getStatusText()}
        </Text>
      </CompletedTextAnimation>
    </View>
  )
}

const PaymentDetailsSection: React.FC<{
  currencyAmount?: string
  satAmount?: string
  satFeeAmount?: string
  currencyFeeAmount?: string
  usernameTitle: string
  destination?: string
  createdAt?: number
  paymentType?: PaymentType | string
  LL: TranslationFunctions
}> = ({
  currencyAmount,
  satAmount,
  satFeeAmount,
  currencyFeeAmount,
  usernameTitle,
  destination,
  createdAt,
  paymentType,
  LL,
}) => {
  const styles = useStyles()

  return (
    <>
      <View style={styles.successActionFieldContainer}>
        <SuccessActionComponent
          title={LL.SendBitcoinScreen.amount()}
          text={currencyAmount}
          subValue={satAmount}
          key="amount"
          visible={Boolean(currencyAmount)}
        />
        <SuccessActionComponent
          title={LL.SendBitcoinScreen.feeLabel()}
          text={currencyFeeAmount}
          subValue={satFeeAmount}
          key="fee"
          visible={Boolean(currencyFeeAmount)}
        />
        <SuccessActionComponent
          title={LL.SendBitcoinScreen.sender()}
          text={usernameTitle}
          key="sender"
          visible={Boolean(usernameTitle)}
        />
        <SuccessActionComponent
          title={LL.SendBitcoinScreen.recipient()}
          text={destination}
          key="recipient"
          visible={Boolean(destination)}
        />
      </View>

      <View style={styles.successActionFieldContainer}>
        <SuccessActionComponent
          title={LL.SendBitcoinScreen.time()}
          text={createdAt ? formatUnixTimestampYMDHM(createdAt) : ""}
          key="time"
          visible={Boolean(createdAt)}
        />
        <SuccessActionComponent
          title={LL.SendBitcoinScreen.type()}
          text={formatPaymentType({
            blinkToBlinkLabel: LL.common.blinkToBlink(),
            paymentType,
          })}
          key="type"
          visible={Boolean(paymentType)}
        />
      </View>
    </>
  )
}

const NoteSection: React.FC<{
  noteMessage: string
  userNote?: string
  LL: TranslationFunctions
}> = ({ noteMessage, userNote, LL }) => {
  const styles = useStyles()

  const displayText = noteMessage || (userNote ? `"${userNote}"` : LL.SendBitcoinScreen.noMessage())

  return (
    <View style={styles.successActionFieldContainer}>
      <SuccessActionComponent
        title={LL.SendBitcoinScreen.message()}
        text={displayText}
        key="note"
        visible={true}
      />
    </View>
  )
}

const HeaderSection: React.FC<{
  isTakingScreenshot: boolean
  onClose: () => void
}> = ({ isTakingScreenshot, onClose }) => {
  const styles = useStyles()

  if (isTakingScreenshot) return null

  return (
    <View style={styles.headerContainer}>
      <GaloyIconButton iconOnly size="large" name="close" onPress={onClose} />
    </View>
  )
}

const SendBitcoinCompletedScreen: React.FC<Props> = ({ route }) => {
  const [showSuccessIcon, setShowSuccessIcon] = useState(true)
  const viewRef = useRef<View>(null)

  const {
    arrivalAtMempoolEstimate,
    status: statusRaw,
    successAction,
    preimage,
    currencyAmount,
    satAmount,
    currencyFeeAmount,
    satFeeAmount,
    destination,
    paymentType,
    createdAt,
    note,
  } = route.params

  const styles = useStyles()
  const {
    theme: { mode },
  } = useTheme()
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "sendBitcoinCompleted">>()
  const { LL } = useI18nContext()

  const feedbackShownData = useFeedbackModalShownQuery()
  const { data } = useSettingsScreenQuery({ fetchPolicy: "cache-first" })
  const { successIconDuration } = useRemoteConfig()

  const status = processStatus({ arrivalAtMempoolEstimate, status: statusRaw })
  const usernameTitle = data?.me?.username || LL.common.blinkUser()
  const noteMessage = useSuccessMessage(successAction, preimage)
  const Logo = mode === "dark" ? LogoDarkMode : LogoLightMode

  const { requestFeedback, showSuggestionModal, setShowSuggestionModal } =
    useFeedbackHandler()
  const { isTakingScreenshot, captureAndShare } = useScreenshot(viewRef)

  useEffect(() => {
    const timer = setTimeout(() => setShowSuccessIcon(false), successIconDuration)
    return () => clearTimeout(timer)
  }, [successIconDuration])

  useEffect(() => {
    const feedbackModalShown = feedbackShownData?.data?.feedbackModalShown

    if (!feedbackModalShown) {
      const feedbackTimeout = setTimeout(requestFeedback, FEEDBACK_DELAY)
      return () => clearTimeout(feedbackTimeout)
    }
  }, [feedbackShownData?.data?.feedbackModalShown, requestFeedback])

  const handleNavigateHome = () => navigation.navigate("Primary")

  if (showSuccessIcon) {
    return (
      <Screen headerShown={false}>
        <SuccessIconComponent
          status={status}
          arrivalAtMempoolEstimate={arrivalAtMempoolEstimate}
        />
      </Screen>
    )
  }

  return (
    <Screen headerShown={false}>
      <HeaderSection
        isTakingScreenshot={isTakingScreenshot}
        onClose={handleNavigateHome}
      />

      <ViewShot ref={viewRef} style={styles.viewShot}>
        <View style={styles.screenContainer}>
          <Logo height={110} />

          <View style={styles.container}>
            <ScrollView>
              <PaymentDetailsSection
                currencyAmount={currencyAmount}
                satAmount={satAmount}
                satFeeAmount={satFeeAmount}
                currencyFeeAmount={currencyFeeAmount}
                usernameTitle={usernameTitle}
                destination={destination}
                createdAt={createdAt}
                paymentType={paymentType}
                LL={LL}
              />

              <NoteSection noteMessage={noteMessage} userNote={note} LL={LL} />
            </ScrollView>
          </View>

          {!isTakingScreenshot && (
            <GaloyPrimaryButton
              style={styles.shareButton}
              onPress={captureAndShare}
              title={LL.common.share()}
              underlayColor="transparent"
            />
          )}
        </View>
      </ViewShot>

      <SuggestionModal
        navigation={navigation}
        showSuggestionModal={showSuggestionModal}
        setShowSuggestionModal={setShowSuggestionModal}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 16,
    paddingBottom: 6,
  },
  screenContainer: {
    flexGrow: 1,
    marginHorizontal: 20,
  },
  viewShot: {
    flexGrow: 1,
    backgroundColor: colors.white,
  },
  completedText: {
    textAlign: "center",
    marginTop: 20,
    marginHorizontal: 28,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  shareButton: {
    marginTop: 10,
    marginBottom: 20,
  },
  successActionFieldContainer: {
    overflow: "hidden",
    gap: 20,
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 14,
    marginBottom: 12,
  },
  successViewContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
}))

export default SendBitcoinCompletedScreen
