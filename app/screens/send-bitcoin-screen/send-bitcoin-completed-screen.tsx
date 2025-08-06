import React, { useCallback, useEffect, useRef, useState } from "react"
import { View, Alert, TouchableHighlight, ScrollView } from "react-native"
import InAppReview from "react-native-in-app-review"
import Share from "react-native-share"
import ViewShot, { captureRef } from "react-native-view-shot"

import { useApolloClient } from "@apollo/client"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { SuccessIconAnimation } from "@app/components/success-animation"
import { SuccessActionComponent } from "@app/components/success-action"
import { setFeedbackModalShown } from "@app/graphql/client-only-query"
import {
  useFeedbackModalShownQuery,
  useSettingsScreenQuery,
} from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logAppFeedback } from "@app/utils/analytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Button, makeStyles, useTheme } from "@rneui/themed"

import { testProps } from "../../utils/testProps"

import { SuggestionModal } from "./suggestion-modal"
import { PaymentSendCompletedStatus } from "./use-send-payment"
import LogoLightMode from "@app/assets/logo/blink-logo-light.svg"
import LogoDarkMode from "@app/assets/logo/app-logo-dark.svg"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SuccessActionTag } from "@app/components/success-action/success-action.props"
import { utils } from "lnurl-pay"
import { formatUnixTimestampYMDHM } from "@app/utils/date"

type Props = {
  route: RouteProp<RootStackParamList, "sendBitcoinCompleted">
}

// TODO: proper type from the backend so we don't need this processing in the front end
// ie: it should return QUEUED for an onchain send payment
type StatusProcessed = "SUCCESS" | "PENDING" | "QUEUED"

const SendBitcoinCompletedScreen: React.FC<Props> = ({ route }) => {
  const viewRef = useRef<View | null>(null)
  const {
    arrivalAtMempoolEstimate,
    status: statusRaw,
    successAction,
    preimage,
    formatAmount,
    feeDisplayText,
    destination,
    paymentType,
    createdAt,
  } = route.params
  const styles = useStyles()
  const {
    theme: { mode, colors },
  } = useTheme()

  const status = processStatus({ arrivalAtMempoolEstimate, status: statusRaw })
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false)

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "sendBitcoinCompleted">>()

  const client = useApolloClient()
  const feedbackShownData = useFeedbackModalShownQuery()
  const feedbackModalShown = feedbackShownData?.data?.feedbackModalShown
  const { data } = useSettingsScreenQuery({ fetchPolicy: "cache-first" })

  const { LL } = useI18nContext()
  const usernameTitle = data?.me?.username || LL.common.blinkUser()

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
  // const CALLBACK_DELAY = 3000
  useEffect(() => {
    if (!feedbackModalShown) {
      const feedbackTimeout = setTimeout(() => {
        requestFeedback()
      }, FEEDBACK_DELAY)
      return () => {
        clearTimeout(feedbackTimeout)
      }
    }
    // if (!successAction?.tag && !showSuggestionModal) {
    //   const navigateToHomeTimeout = setTimeout(navigation.popToTop, CALLBACK_DELAY)
    //   return () => clearTimeout(navigateToHomeTimeout)
    // }
  }, [
    client,
    feedbackModalShown,
    LL,
    showSuggestionModal,
    navigation,
    requestFeedback,
    successAction,
  ])

  const captureAndShare = async () => {
    try {
      setIsTakingScreenshot(true)

      // To wait before hiding buttons
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 100)
      })

      const uri = await captureRef(viewRef, {
        format: "jpg",
        quality: 0.9,
      })

      await Share.open({
        url: uri,
        failOnCancel: false,
      })
    } catch (_) {
      // Do nothing
    }
    setIsTakingScreenshot(false)
  }

  const MainIcon = () => {
    switch (status) {
      case "SUCCESS":
        return <GaloyIcon name={"payment-success"} size={70} />
      case "QUEUED":
        return <GaloyIcon name={"payment-pending"} size={70} />
      case "PENDING":
        return <GaloyIcon name={"warning"} color={colors._orange} size={70} />
    }
  }

  const Logo = mode === "dark" ? LogoDarkMode : LogoLightMode

  const noteMessage = (): string => {
    if (!successAction) return ""

    const { tag, message, description, url } = successAction
    const decryptedMessage =
      tag === SuccessActionTag.AES && preimage
        ? utils.decipherAES({ successAction, preimage })
        : null

    const parts = []

    if (message) {
      parts.push(message)
    }
    if (url) {
      parts.push(url)
    }
    if (description) {
      parts.push(description)
    }
    if (decryptedMessage) {
      parts.push(decryptedMessage)
    }

    return parts.join(" ")
  }

  return (
    <Screen>
      <ViewShot ref={viewRef} style={styles.viewShot}>
        <View style={styles.screenContainer} {...testProps("Success Text")}>
          <View style={styles.successIcon} {...testProps(status)}>
            <SuccessIconAnimation>{MainIcon()}</SuccessIconAnimation>
          </View>
          <Logo height={65} />
          <View style={styles.container}>
            <ScrollView>
              <SuccessActionComponent
                title={LL.SendBitcoinScreen.amount()}
                text={formatAmount}
                key={1}
                visible={Boolean(formatAmount)}
              />
              <SuccessActionComponent
                title={LL.SendBitcoinScreen.feeLabel()}
                text={`${feeDisplayText} | ${paymentType === "intraledger" ? "Blink to Blink" : paymentType}`}
                key={2}
                visible={Boolean(feeDisplayText)}
              />
              <SuccessActionComponent
                title={LL.SendBitcoinScreen.sender()}
                text={usernameTitle}
                key={3}
                visible={Boolean(usernameTitle)}
                {...(!isTakingScreenshot && { icon: "pencil" })}
              />
              <SuccessActionComponent
                title={LL.SendBitcoinScreen.recipient()}
                text={destination}
                key={4}
                visible={Boolean(destination)}
                {...(!isTakingScreenshot && { icon: "pencil" })}
              />
              <SuccessActionComponent
                title={LL.SendBitcoinScreen.time()}
                text={formatUnixTimestampYMDHM(createdAt!)}
                key={5}
                visible={Boolean(createdAt)}
              />
              <SuccessActionComponent
                title={LL.SendBitcoinScreen.noteLabel()}
                text={noteMessage()}
                key={6}
                visible={Boolean(noteMessage())}
                {...(!isTakingScreenshot && { icon: "copy-paste" })}
              />
            </ScrollView>
          </View>

          {!isTakingScreenshot && (
            <GaloyPrimaryButton
              style={styles.shareButton}
              onPress={captureAndShare}
              title={LL.common.share()}
            />
          )}

          {!isTakingScreenshot && (
            <Button
              title={LL.common.close()}
              onPress={() => navigation.navigate("Primary")}
              TouchableComponent={TouchableHighlight}
              titleStyle={{ color: colors.primary }}
              containerStyle={styles.containerStyle}
              buttonStyle={styles.buttonStyle}
            />
          )}
          <SuggestionModal
            navigation={navigation}
            showSuggestionModal={showSuggestionModal}
            setShowSuggestionModal={setShowSuggestionModal}
          />
        </View>
      </ViewShot>
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
  screenContainer: {
    flexGrow: 1,
    marginHorizontal: 20,
  },
  viewShot: {
    flexGrow: 1,
  },
  completedText: {
    textAlign: "center",
    marginTop: 20,
    marginHorizontal: 28,
  },
  successIcon: {
    alignItems: "center",
    justifyContent: "center",
    height: 110,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  containerStyle: {
    height: 42,
    borderRadius: 12,
    marginBottom: 20,
    marginTop: 10,
  },
  buttonStyle: {
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.transparent,
  },
  shareButton: {
    marginTop: 10,
  },
}))

export default SendBitcoinCompletedScreen
