import * as React from "react"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import {
  OnboardingStackParamList,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"

import { OnboardingLayout } from "./onboarding-layout"

type WelcomeLevel1ScreenProps = {
  route: RouteProp<OnboardingStackParamList, "welcomeLevel1">
}

export const WelcomeLevel1Screen: React.FC<WelcomeLevel1ScreenProps> = ({ route }) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { onboarding } = route.params

  const handlePrimaryAction = () => {
    navigation.replace("onboarding", {
      screen: "emailBenefits",
      params: { onboarding },
    })
  }

  return (
    <OnboardingLayout
      title={LL.OnboardingScreen.welcomeLevel1.title()}
      descriptions={[
        LL.OnboardingScreen.welcomeLevel1.receiveBitcoinDescription(),
        LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription(),
        LL.OnboardingScreen.welcomeLevel1.onchainDescription(),
      ]}
      primaryLabel={LL.common.next()}
      onPrimaryAction={handlePrimaryAction}
      iconName="welcome"
    />
  )
}
