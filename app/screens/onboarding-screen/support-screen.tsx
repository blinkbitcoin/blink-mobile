import * as React from "react"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles } from "@rneui/themed"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useRemoteConfig } from "@app/config/feature-flags-context"

import { OnboardingLayout } from "./onboarding-layout"

export const SupportOnboardingScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { feedbackEmailAddress } = useRemoteConfig()

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
      const unsubscribe = navigation.addListener("beforeRemove", (e) => {
        if (e.data.action.type === "POP" || e.data.action.type === "GO_BACK") {
          e.preventDefault()
        }
      })
      return unsubscribe
    }, [navigation]),
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
