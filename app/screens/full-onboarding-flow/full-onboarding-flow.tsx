import React, { useEffect, useState } from "react"
import { ActivityIndicator, Alert, Linking, View } from "react-native"
import InAppBrowser from "react-native-inappbrowser-reborn"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button"
import { Screen } from "@app/components/screen"
import {
  OnboardingStatus,
  useFullOnboardingScreenQuery,
  useOnboardingFlowStartMutation,
} from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { Input, Text, makeStyles, useTheme } from "@rn-vui/themed"

gql`
  mutation onboardingFlowStart($input: OnboardingFlowStartInput!) {
    onboardingFlowStart(input: $input) {
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
  const navigation = useNavigation()

  const { LL } = useI18nContext()

  const {
    theme: { colors },
  } = useTheme()

  const styles = useStyles()

  const { data, loading } = useFullOnboardingScreenQuery({ fetchPolicy: "network-only" })

  const onboardingStatus = data?.me?.defaultAccount?.onboardingStatus

  const [loadingOnfido, setLoadingOnfido] = useState(false)

  const [onboardingFlowStart] = useOnboardingFlowStartMutation()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  useEffect(() => {
    InAppBrowser.warmup()
  }, [])

  const {
    appConfig: {
      galoyInstance: { kycUrl },
    },
  } = useAppConfig()

  const confirmNames = async () => {
    Alert.alert(
      LL.FullOnboarding.confirmNameTitle(),
      LL.FullOnboarding.confirmNameContent({ firstName, lastName }),
      [
        { text: LL.common.cancel(), onPress: () => {} },
        {
          text: LL.common.yes(),
          onPress: onfidoStart,
        },
      ],
    )
  }

  const onfidoStart = React.useCallback(async () => {
    setLoadingOnfido(true)

    try {
      console.log("onfidoStart", firstName, lastName)
      const res = await onboardingFlowStart({
        variables: { input: { firstName, lastName } },
      })

      const workflowRunId = res.data?.onboardingFlowStart?.workflowRunId
      if (!workflowRunId) {
        Alert.alert("no workflowRunId")
        setLoadingOnfido(false)
        return
      }

      const tokenWeb = res.data?.onboardingFlowStart?.tokenWeb

      const page = `${kycUrl}/webflow?token=${tokenWeb}&workflow_run_id=${workflowRunId}`

      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(page, {
          dismissButtonStyle: "done",
          enableDefaultShare: false,
          hasBackButton: false,
          showInRecents: false,
        })
        navigation.goBack()
      } else {
        Linking.openURL(page)
      }
    } catch (err) {
      console.error(err, "error")
      let message = ""
      if (err instanceof Error) {
        message = err.message
      }

      if (message.match(/canceled/i)) {
        navigation.goBack()
        setLoadingOnfido(false)
        return
      }

      Alert.alert(
        LL.FullOnboarding.error(),
        `${LL.GaloyAddressScreen.somethingWentWrong()}\n\n${message}`,
        [
          {
            text: LL.common.ok(),
            onPress: () => {
              navigation.goBack()
            },
          },
        ],
      )
    } finally {
      setLoadingOnfido(false)
    }
  }, [LL, firstName, lastName, navigation, onboardingFlowStart, kycUrl])

  useEffect(() => {
    if (onboardingStatus === OnboardingStatus.AwaitingInput) {
      onfidoStart()
    }
  }, [onboardingStatus, onfidoStart])

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
        <>
          <Input
            placeholder={LL.FullOnboarding.firstName()}
            value={firstName}
            onChangeText={(text) => setFirstName(text)}
          />
          <Input
            placeholder={LL.FullOnboarding.lastName()}
            value={lastName}
            onChangeText={(text) => setLastName(text)}
          />
        </>
        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton
            onPress={confirmNames}
            title={LL.common.next()}
            disabled={!firstName || !lastName}
            loading={loadingOnfido}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  screenStyle: {
    flexGrow: 1,
  },

  innerView: {
    padding: 20,
  },

  textStyle: {
    marginBottom: 32,
  },

  buttonContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },

  verticalAlignment: { flex: 1, justifyContent: "center", alignItems: "center" },
}))
