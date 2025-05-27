import * as React from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"

import { OnboardingLayout } from "./onboarding-layout"

export const EmailBenefitsScreen: React.FC = () => {
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handlePrimaryAction = () => {
    navigation.navigate("Primary")
  }

  const handleSecondaryAction = () => {
    navigation.navigate("onboarding", {
      screen: "lightningBenefits",
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
