import * as React from "react"
import { RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import {
  OnboardingStackParamList,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"

import { OnboardingLayout } from "./onboarding-layout"

type SupportOnboardingScreenProps = {
  route: RouteProp<OnboardingStackParamList, "supportScreen">
}

export const SupportOnboardingScreen: React.FC<SupportOnboardingScreenProps> = ({
  route,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { feedbackEmailAddress } = useRemoteConfig()

  const canGoBack = route.params?.canGoBack ?? true

  const handlePrimaryAction = () => {
    navigation.replace("Primary")
  }

  const contactInfoString = LL.OnboardingScreen.supportScreen.description({
    email: feedbackEmailAddress,
  })

  const [prefix, suffix] = contactInfoString.split(feedbackEmailAddress)

  // Prevent back navigation
  useFocusEffect(
    React.useCallback(() => {
      if (canGoBack) return

      const unsubscribe = navigation.addListener("beforeRemove", (e) => {
        if (e.data.action.type === "POP" || e.data.action.type === "GO_BACK") {
          e.preventDefault()
        }
      })
      return unsubscribe
    }, [navigation, canGoBack]),
  )

  return (
    <OnboardingLayout
      title={LL.OnboardingScreen.supportScreen.title()}
      customContent={
        <Text type="h2" style={styles.descriptionText}>
          {prefix}
          <Text style={styles.linkText}>{feedbackEmailAddress}</Text>
          {suffix}
        </Text>
      }
      primaryLabel={LL.OnboardingScreen.supportScreen.primaryButton()}
      onPrimaryAction={handlePrimaryAction}
      iconName="support"
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  descriptionText: {
    color: colors.grey2,
    marginBottom: 15,
  },
  linkText: {
    color: colors.primary,
  },
}))
