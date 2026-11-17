import React, { useCallback, useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { NotificationCardUI } from "@app/components/notifications/notification-card-ui"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  TwoFactorPrompt,
  TwoFactorReminderReason,
} from "@app/types/two-factor-enforcement"

/** Where a card's button goes: the setup, which offers both ways forward, or straight
 *  to the authenticator onboarding, for a card whose button names the authenticator. */
type TwoFactorHomeCardDestination = Extract<
  keyof RootStackParamList,
  "twoFactorSetup" | "totpRegistrationIntro"
>

type TwoFactorHomeCardProps = {
  prompt: TwoFactorPrompt
  destination: TwoFactorHomeCardDestination
  /** Why the card is up, for the prompt that reports one. */
  reason?: TwoFactorReminderReason
  title: string
  text: string
  buttonLabel: string
  /** The prompt's own dismissal, which the X hands to. */
  onDismiss: () => void
}

/**
 * A two-factor prompt on the home, as a card: it reports itself as shown to the
 * enforcement, which counts the impressions, and its button opens its destination, told
 * which prompt opened it and why it was up. What sets one prompt apart from another is
 * its copy, its destination and its dismissal.
 */
export const TwoFactorHomeCard: React.FC<TwoFactorHomeCardProps> = ({
  prompt,
  destination,
  reason,
  title,
  text,
  buttonLabel,
  onDismiss,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { markPromptShown } = useTwoFactorEnforcement()

  useEffect(() => {
    markPromptShown(prompt, reason)
  }, [markPromptShown, prompt, reason])

  const handleSet = useCallback(() => {
    navigation.navigate(destination, { origin: { prompt, reason } })
  }, [navigation, destination, prompt, reason])

  return (
    <NotificationCardUI
      title={title}
      text={text}
      action={handleSet}
      dismissAction={onDismiss}
      buttonLabel={buttonLabel}
    />
  )
}
