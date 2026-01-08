import React, { useEffect, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { ActivityIndicator, Alert, View } from "react-native"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { gql } from "@apollo/client"

import { Screen } from "@app/components/screen"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button"

import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  OnboardingStatus,
  useFullOnboardingScreenQuery,
  useKycFlowStartMutation,
} from "@app/graphql/generated"

gql`
  mutation kycFlowStart {
    kycFlowStart {
      workflowRunId
      tokenWeb
    }
  }

  query fullOnboardingScreen {
    me {
      id
      defaultAccount {
        ... on ConsumerAccount {
          id
          onboardingStatus
        }
      }
    }
  }
`

export const FullOnboardingFlowScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Primary">>()
  const { navigate, goBack } = navigation

  const { LL, locale } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors, mode },
  } = useTheme()

  const { data, loading } = useFullOnboardingScreenQuery({ fetchPolicy: "network-only" })

  const onboardingStatus = data?.me?.defaultAccount?.onboardingStatus

  const [loadingSumsub, setLoadingSumsub] = useState(false)

  const [kycFlowStart] = useKycFlowStartMutation()

  const {
    appConfig: {
      galoyInstance: { kycUrl },
    },
  } = useAppConfig()

  const sumsubStart = React.useCallback(async () => {
    setLoadingSumsub(true)

    try {
      const res = await kycFlowStart()

      const token = res.data?.kycFlowStart?.tokenWeb ?? ""

      const theme = mode === "dark" || mode === "light" ? mode : ""

      const query = new URLSearchParams({
        token,
        ...(locale && { lang: locale }),
        ...(theme && { theme }),
      }).toString()

      const url = `${kycUrl}/webflow?${query}`

      navigate("webView", {
        url,
        headerTitle: LL.UpgradeAccountModal.title(),
      })
    } catch (err) {
      console.error(err, "error")
      let message = ""
      if (err instanceof Error) {
        message = err.message
      }

      if (message.match(/canceled/i)) {
        goBack()
        setLoadingSumsub(false)
        return
      }

      Alert.alert(
        LL.FullOnboarding.error(),
        `${LL.GaloyAddressScreen.somethingWentWrong()}\n\n${message}`,
        [
          {
            text: LL.common.ok(),
            onPress: () => {
              goBack()
            },
          },
        ],
      )
    } finally {
      setLoadingSumsub(false)
    }
  }, [LL, locale, mode, navigate, goBack, kycFlowStart, kycUrl])

  useEffect(() => {
    if (onboardingStatus === OnboardingStatus.AwaitingInput) {
      sumsubStart()
    }
  }, [onboardingStatus, sumsubStart])

  if (loading) {
    return (
      <Screen
        preset="scroll"
        keyboardShouldPersistTaps="handled"
        keyboardOffset="navigationHeader"
        style={styles.screenStyle}
      >
        <View style={styles.verticalAlignment}>
          <ActivityIndicator animating size="large" color={colors.primary} />
        </View>
      </Screen>
    )
  }

  if (
    onboardingStatus === OnboardingStatus.Abandoned ||
    onboardingStatus === OnboardingStatus.Approved ||
    onboardingStatus === OnboardingStatus.Declined ||
    onboardingStatus === OnboardingStatus.Error ||
    onboardingStatus === OnboardingStatus.Processing ||
    onboardingStatus === OnboardingStatus.Review
  ) {
    return (
      <Screen
        preset="scroll"
        keyboardShouldPersistTaps="handled"
        keyboardOffset="navigationHeader"
        style={styles.screenStyle}
      >
        <Text
          type="h2"
          style={styles.textStyle}
        >{`${LL.FullOnboarding.status()}${LL.FullOnboarding[onboardingStatus]()}.`}</Text>
        <ContactSupportButton />
      </Screen>
    )
  }

  return (
    <Screen
      preset="scroll"
      keyboardShouldPersistTaps="handled"
      keyboardOffset="navigationHeader"
      style={styles.screenStyle}
    >
      <View style={styles.innerView}>
        <Text type="h2" style={styles.textStyle}>
          {LL.FullOnboarding.requirements()}
        </Text>
        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton
            onPress={sumsubStart}
            title={LL.common.next()}
            disabled={false}
            loading={loadingSumsub}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  screenStyle: {
    flex: 1,
  },

  innerView: {
    flex: 1,
    padding: 20,
  },

  textStyle: {
    marginBottom: 32,
  },

  buttonContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 15,
  },

  verticalAlignment: { flex: 1, justifyContent: "center", alignItems: "center" },
}))
