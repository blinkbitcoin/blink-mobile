import React, { useCallback, useEffect } from "react"
import { View, Alert } from "react-native"
import InAppReview from "react-native-in-app-review"

import { useApolloClient } from "@apollo/client"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import {
  SuccessIconAnimation,
  CompletedTextAnimation,
} from "@app/components/success-animation"
import { SuccessActionComponent } from "@app/components/success-action"
import { setFeedbackModalShown } from "@app/graphql/client-only-query"
import { useFeedbackModalShownQuery } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logAppFeedback } from "@app/utils/analytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import {
  formatTimeToMempool,
  timeToMempool,
} from "../transaction-detail-screen/format-time"
import { SuggestionModal } from "./suggestion-modal"
import { PaymentSendCompletedStatus } from "./use-send-payment"

type Props = {
  route: RouteProp<RootStackParamList, "sendBitcoinCompleted">
}

// TODO: proper type from the backend so we don't need this processing in the front end
// ie: it should return QUEUED for an onchain send payment
type StatusProcessed = "SUCCESS" | "PENDING" | "QUEUED"

const SendBitcoinCompletedScreen: React.FC<Props> = ({ route }) => {
  const {
    arrivalAtMempoolEstimate,
    status: statusRaw,
    successAction,
    preimage,
  } = route.params
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const status = processStatus({ arrivalAtMempoolEstimate, status: statusRaw })

  const [showSuggestionModal, setShowSuggestionModal] = React.useState(false)
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "sendBitcoinCompleted">>()

  const client = useApolloClient()
  const feedbackShownData = useFeedbackModalShownQuery()
  const feedbackModalShown = feedbackShownData?.data?.feedbackModalShown
  const { LL, locale } = useI18nContext()

  const iDontEnjoyTheApp = () => {
    logAppFeedback({
      isEnjoingApp: false,
    })
    setShowSuggestionModal(true)
  }

  const iEnjoyTheApp = () => {
    logAppFeedback({
      isEnjoingApp: true,
    })
    InAppReview.RequestInAppReview()
  }

  const { appConfig } = useAppConfig()

  const requestFeedback = useCallback(() => {
    if (!appConfig || appConfig.galoyInstance.id === "Local") {
      return
    }

    if (InAppReview.isAvailable()) {
      Alert.alert(
        "",
        LL.support.enjoyingApp(),
        [
          {
            text: LL.common.No(),
            onPress: () => iDontEnjoyTheApp(),
          },
          {
            text: LL.common.yes(),
            onPress: () => iEnjoyTheApp(),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {},
        },
      )
      setFeedbackModalShown(client, true)
    }
  }, [LL, client, appConfig])

  const FEEDBACK_DELAY = 3000
  const CALLBACK_DELAY = 3000
  useEffect(() => {
    if (!feedbackModalShown) {
      const feedbackTimeout = setTimeout(() => {
        requestFeedback()
      }, FEEDBACK_DELAY)
      return () => {
        clearTimeout(feedbackTimeout)
      }
    }
    if (!successAction?.tag && !showSuggestionModal) {
      const navigateToHomeTimeout = setTimeout(navigation.popToTop, CALLBACK_DELAY)
      return () => clearTimeout(navigateToHomeTimeout)
    }
  }, [
    client,
    feedbackModalShown,
    LL,
    showSuggestionModal,
    navigation,
    requestFeedback,
    successAction,
  ])

  const MainIcon = () => {
    switch (status) {
      case "SUCCESS":
        return <GaloyIcon name={"payment-success"} size={128} />
      case "QUEUED":
        return <GaloyIcon name={"payment-pending"} size={128} />
      case "PENDING":
        return <GaloyIcon name={"warning"} color={colors._orange} size={128} />
    }
  }

  const SuccessText = () => {
    switch (status) {
      case "SUCCESS":
        return LL.SendBitcoinScreen.success()
      case "QUEUED":
        return LL.TransactionDetailScreen.txNotBroadcast({
          countdown: formatTimeToMempool(
            timeToMempool(arrivalAtMempoolEstimate as number),
            LL,
            locale,
          ),
        })
      case "PENDING":
        return LL.SendBitcoinScreen.pendingPayment()
    }
  }

  return (
    <Screen preset="scroll" style={styles.contentContainer}>
      <View style={styles.Container}>
        <SuccessIconAnimation>{MainIcon()}</SuccessIconAnimation>
        <CompletedTextAnimation>
          <Text {...testProps("Success Text")} style={styles.completedText} type="h2">
            {SuccessText()}
          </Text>
        </CompletedTextAnimation>
        <SuccessActionComponent successAction={successAction} preimage={preimage} />
      </View>
      <SuggestionModal
        navigation={navigation}
        showSuggestionModal={showSuggestionModal}
        setShowSuggestionModal={setShowSuggestionModal}
      />
    </Screen>
  )
}

const processStatus = ({
  status,
  arrivalAtMempoolEstimate,
}: {
  status: PaymentSendCompletedStatus
  arrivalAtMempoolEstimate: number | undefined
}): StatusProcessed => {
  if (status === "SUCCESS") {
    return "SUCCESS"
  }

  if (arrivalAtMempoolEstimate) {
    return "QUEUED"
  }
  return "PENDING"
}

const useStyles = makeStyles(({ colors }) => ({
  contentContainer: {
    flexGrow: 1,
  },
  completedText: {
    textAlign: "center",
    marginTop: 20,
    marginHorizontal: 28,
  },
  Container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  view: {
    marginHorizontal: 20,
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 20,
  },
}))

export default SendBitcoinCompletedScreen
