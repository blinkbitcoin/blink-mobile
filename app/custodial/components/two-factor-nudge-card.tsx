import React, { useCallback, useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { NotificationCardUI } from "@app/components/notifications/notification-card-ui"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorPrompt, TwoFactorTier } from "@app/types/two-factor-enforcement"
import {
  logTwoFactorPromptDismissed,
  logTwoFactorPromptShown,
} from "@app/utils/analytics"

type TwoFactorNudgeCardProps = {
  tier: TwoFactorTier
  onDismiss: () => void
}

export const TwoFactorNudgeCard: React.FC<TwoFactorNudgeCardProps> = ({
  tier,
  onDismiss,
}) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useEffect(() => {
    logTwoFactorPromptShown({ tier, prompt: TwoFactorPrompt.HomeCard })
  }, [tier])

  const handleSet = useCallback(async () => {
    navigation.navigate("twoFactorSetup")
  }, [navigation])

  const handleDismiss = useCallback(() => {
    logTwoFactorPromptDismissed({ tier, prompt: TwoFactorPrompt.HomeCard })
    onDismiss()
  }, [tier, onDismiss])

  return (
    <NotificationCardUI
      title={LL.TwoFactorEnforcement.title()}
      text={LL.TwoFactorEnforcement.cardDescription()}
      action={handleSet}
      dismissAction={handleDismiss}
      buttonLabel={LL.TwoFactorEnforcement.cardCta()}
    />
  )
}
