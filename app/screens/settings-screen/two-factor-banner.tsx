import React, { useCallback, useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorPrompt, TwoFactorTier } from "@app/types/two-factor-enforcement"
import { logTwoFactorPromptShown } from "@app/utils/analytics"

import { SettingsCard } from "./settings-card"

type TwoFactorBannerProps = {
  tier: TwoFactorTier
}

export const TwoFactorBanner: React.FC<TwoFactorBannerProps> = ({ tier }) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useEffect(() => {
    logTwoFactorPromptShown({ tier, prompt: TwoFactorPrompt.SettingsBanner })
  }, [tier])

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
