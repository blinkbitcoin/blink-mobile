import React, { useCallback, useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { NotificationCardUI } from "@app/components/notifications/notification-card-ui"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorPrompt } from "@app/types/two-factor-enforcement"

export const TwoFactorNudgeCard: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { markPromptShown, dismissNudgeCard } = useTwoFactorEnforcement()

  useEffect(() => {
    markPromptShown(TwoFactorPrompt.HomeCard)
  }, [markPromptShown])

  const handleSet = useCallback(() => {
    navigation.navigate("twoFactorSetup")
  }, [navigation])

  return (
    <NotificationCardUI
      title={LL.TwoFactorEnforcement.title()}
      text={LL.TwoFactorEnforcement.cardDescription()}
      action={handleSet}
      dismissAction={dismissNudgeCard}
      buttonLabel={LL.TwoFactorEnforcement.cardCta()}
    />
  )
}
