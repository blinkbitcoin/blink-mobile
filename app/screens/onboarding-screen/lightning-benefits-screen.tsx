import * as React from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"

import { OnboardingInfoTemplateScreen } from "./Info-template-screen"

export const LightningBenefitsScreen: React.FC = () => {
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
      title={LL.OnboardingScreen.lightningBenefits.title()}
      descriptions={[
        LL.OnboardingScreen.lightningBenefits.staticAddressDescription(),
        LL.OnboardingScreen.lightningBenefits.easyToShareDescription(),
        LL.OnboardingScreen.lightningBenefits.blinkToolsDescription(),
      ]}
      primaryLabel={LL.OnboardingScreen.lightningBenefits.primaryButton()}
      onPrimaryAction={handlePrimaryAction}
      secondaryLabel={LL.UpgradeAccountModal.notNow()}
      onSecondaryAction={handleSecondaryAction}
      iconName="lightning"
    />
  )
}
