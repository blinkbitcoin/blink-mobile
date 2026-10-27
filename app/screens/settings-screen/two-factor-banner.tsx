import React, { useCallback, useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorPrompt } from "@app/types/two-factor-enforcement"

import { SettingsCard } from "./settings-card"

export const TwoFactorBanner: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { markPromptShown } = useTwoFactorEnforcement()

  useEffect(() => {
    markPromptShown(TwoFactorPrompt.SettingsBanner)
  }, [markPromptShown])

  const handlePress = useCallback(() => {
    navigation.navigate("twoFactorSetup")
  }, [navigation])

  return (
    <SettingsCard
      title={LL.TwoFactorEnforcement.title()}
      description={LL.TwoFactorEnforcement.settingsDescription()}
      onPress={handlePress}
      borderColor="warning"
      titleColor="warning"
    />
  )
}
