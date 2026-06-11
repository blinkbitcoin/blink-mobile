import * as React from "react"
import { RouteProp, useNavigation, useFocusEffect } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import {
  OnboardingStackParamList,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"

import { OnboardingLayout } from "./onboarding-layout"

type WelcomeLevel1ScreenProps = {
  route: RouteProp<OnboardingStackParamList, "welcomeLevel1">
}

export const WelcomeLevel1Screen: React.FC<WelcomeLevel1ScreenProps> = ({ route }) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { data, loading } = useSettingsScreenQuery()

  const { onboarding } = route.params

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

  const handlePrimaryAction = () => {
    navigation.navigate("onboarding", {
      screen: "emailBenefits",
      params: { onboarding, hasUsername: Boolean(data?.me?.username) },
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
      primaryLoading={loading}
      onPrimaryAction={handlePrimaryAction}
      iconName="welcome"
    />
  )
}
