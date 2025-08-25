import * as React from "react"
import { RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import {
  OnboardingStackParamList,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"

import { OnboardingLayout } from "./onboarding-layout"

type LightningBenefitsScreenProps = {
  route: RouteProp<OnboardingStackParamList, "lightningBenefits">
}

export const LightningBenefitsScreen: React.FC<LightningBenefitsScreenProps> = ({
  route,
}) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { onboarding, canGoBack = true } = route.params

  const handlePrimaryAction = () => {
    navigation.navigate("setLightningAddress", {
      onboarding,
    })
  }

  const handleSecondaryAction = () => {
    navigation.navigate("onboarding", {
      screen: "supportScreen",
    })
  }

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
      iconName="lightning-address"
    />
  )
}
