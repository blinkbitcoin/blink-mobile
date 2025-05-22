import * as React from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"

import { OnboardingInfoTemplateScreen } from "./Info-template-screen"

export const SupportOnboardingScreen: React.FC = () => {
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handlePrimaryAction = () => {
    navigation.navigate("login", { type: "Login" })
  }

  const handleSecondaryAction = () => {
    navigation.navigate("login", { type: "Login" })
  }

  return (
    <OnboardingInfoTemplateScreen
      title={LL.OnboardingScreen.supportScreen.title()}
      descriptions={[
        LL.OnboardingScreen.supportScreen.description(),
        LL.OnboardingScreen.supportScreen.contactInfo({
          contactEmail: "support@blink.sv",
        }),
      ]}
      primaryLabel={LL.OnboardingScreen.supportScreen.primaryButton()}
      onPrimaryAction={handlePrimaryAction}
      secondaryLabel={LL.OnboardingScreen.supportScreen.secondaryButton()}
      onSecondaryAction={handleSecondaryAction}
      iconName="mail-check"
    />
  )
}
