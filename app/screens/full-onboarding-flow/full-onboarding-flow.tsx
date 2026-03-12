import React, { useEffect, useState } from "react"
import { ActivityIndicator, Alert, View } from "react-native"
import { Input, Text, makeStyles, useTheme } from "@rn-vui/themed"
import { gql } from "@apollo/client"

import { Screen } from "@app/components/screen"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button"

import { useKycFlow } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { OnboardingStatus, useFullOnboardingScreenQuery } from "@app/graphql/generated"

gql`
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
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { data, loading } = useFullOnboardingScreenQuery({ fetchPolicy: "network-only" })

  const onboardingStatus = data?.me?.defaultAccount?.onboardingStatus

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  const { startKyc, loading: loadingKyc } = useKycFlow({ firstName, lastName })

  const confirmNames = async () => {
    Alert.alert(
      LL.FullOnboarding.confirmNameTitle(),
      LL.FullOnboarding.confirmNameContent({ firstName, lastName }),
      [
        { text: LL.common.cancel(), onPress: () => {} },
        {
          text: LL.common.yes(),
          onPress: startKyc,
        },
      ],
    )
  }

  useEffect(() => {
    if (onboardingStatus === OnboardingStatus.AwaitingInput) {
      startKyc()
    }
  }, [onboardingStatus, startKyc])

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
            loading={loadingKyc}
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
