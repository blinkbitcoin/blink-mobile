import * as React from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"

import { OnboardingLayout } from "./onboarding-layout"

export const LightningConfirmedScreen: React.FC = () => {
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handlePrimaryAction = () => {
    navigation.navigate("onboarding", {
      screen: "supportScreen",
    })
  }

  return (
    <OnboardingLayout
      title={LL.OnboardingScreen.lightningConfirmed.title()}
      descriptions={[
        LL.OnboardingScreen.lightningBenefits.staticAddressDescription(),
        LL.OnboardingScreen.lightningBenefits.easyToShareDescription(),
        LL.OnboardingScreen.lightningBenefits.blinkToolsDescription(),
      ]}
      primaryLabel={LL.common.next()}
      onPrimaryAction={handlePrimaryAction}
      iconName="lightning-address-set"
    />
  )
}
