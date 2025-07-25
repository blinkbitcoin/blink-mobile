import * as React from "react"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import {
  OnboardingStackParamList,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"

import { OnboardingLayout } from "./onboarding-layout"

type EmailBenefitsScreenProps = {
  route: RouteProp<OnboardingStackParamList, "emailBenefits">
}

export const EmailBenefitsScreen: React.FC<EmailBenefitsScreenProps> = ({ route }) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { onboarding, hasUsername = false } = route.params

  const handlePrimaryAction = () => {
    navigation.navigate("emailRegistrationInitiate", {
      onboarding,
    })
  }

  const handleSecondaryAction = () => {
    if (hasUsername) {
      navigation.navigate("onboarding", {
        screen: "supportScreen",
      })
      return
    }

    navigation.navigate("onboarding", {
      screen: "lightningBenefits",
      params: { onboarding },
    })
  }

  return (
    <OnboardingLayout
      title={LL.OnboardingScreen.emailBenefits.title()}
      descriptions={[
        LL.OnboardingScreen.emailBenefits.backupDescription(),
        LL.OnboardingScreen.emailBenefits.supportDescription(),
        LL.OnboardingScreen.emailBenefits.securityDescription(),
      ]}
      primaryLabel={LL.OnboardingScreen.emailBenefits.primaryButton()}
      onPrimaryAction={handlePrimaryAction}
      secondaryLabel={LL.UpgradeAccountModal.notNow()}
      onSecondaryAction={handleSecondaryAction}
      iconName="email-question"
    />
  )
}
