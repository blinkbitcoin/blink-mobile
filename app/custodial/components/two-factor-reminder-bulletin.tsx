import React, { useCallback, useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { NotificationCardUI } from "@app/components/notifications/notification-card-ui"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorPrompt } from "@app/types/two-factor-enforcement"

/**
 * The reminder tier's bulletin on the home: the card component, outlined so it reads as
 * more than the nudge, and always the same, whether it is one of the first sessions or
 * a new all-time high that brought it back. It never says how often it comes back. Its
 * button opens the setup, where leaving unfinished is the session's dismissal, as the X
 * here is.
 */
export const TwoFactorReminderBulletin: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { reminderReason, markPromptShown, dismissReminderBulletin } =
    useTwoFactorEnforcement()

  useEffect(() => {
    if (reminderReason === null) return
    markPromptShown(TwoFactorPrompt.ReminderBulletin, reminderReason)
  }, [reminderReason, markPromptShown])

  const handleSet = useCallback(() => {
    navigation.navigate("twoFactorSetup")
  }, [navigation])

  return (
    <NotificationCardUI
      title={LL.TwoFactorEnforcement.reminderTitle()}
      text={LL.TwoFactorEnforcement.reminderDescription()}
      action={handleSet}
      dismissAction={dismissReminderBulletin}
      buttonLabel={LL.TwoFactorEnforcement.setAuthenticator()}
      isHighlighted
    />
  )
}
