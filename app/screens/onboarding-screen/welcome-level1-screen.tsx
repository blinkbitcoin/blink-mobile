import * as React from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"

import { OnboardingInfoTemplateScreen } from "./Info-template-screen"

export const WelcomeLevel1Screen: React.FC = () => {
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handlePrimaryAction = () => {
    navigation.navigate("login", { type: "Login" })
  }

  return (
    <OnboardingInfoTemplateScreen
      title={LL.OnboardingScreen.welcomeLevel1.title()}
      descriptions={[
        LL.OnboardingScreen.welcomeLevel1.receibeBitcoinDescription(),
        LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription(),
        LL.OnboardingScreen.welcomeLevel1.onchainDescription(),
      ]}
      primaryLabel={LL.common.next()}
      onPrimaryAction={handlePrimaryAction}
      iconName="rank"
    />
  )
}
