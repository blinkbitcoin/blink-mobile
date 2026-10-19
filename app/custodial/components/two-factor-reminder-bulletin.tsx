import React from "react"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TwoFactorPrompt } from "@app/types/two-factor-enforcement"

import { TwoFactorHomeCard } from "./two-factor-home-card"

/**
 * The recommended tier's bulletin on the home: the card, outlined so it reads as more
 * than the nudge, and always the same, whether it is one of the first sessions or a new
 * all-time high that brought it back. It never says how often it comes back. Its button
 * opens the setup, where leaving unfinished is the session's dismissal, as the X here
 * is. With no reason to be up, it is not.
 */
export const TwoFactorReminderBulletin: React.FC = () => {
  const { LL } = useI18nContext()
  const { reminderReason, dismissReminderBulletin } = useTwoFactorEnforcement()

  if (reminderReason === null) return null

  return (
    <TwoFactorHomeCard
      prompt={TwoFactorPrompt.ReminderBulletin}
      reason={reminderReason}
      title={LL.TwoFactorEnforcement.reminderTitle()}
      text={LL.TwoFactorEnforcement.reminderDescription()}
      buttonLabel={LL.TwoFactorEnforcement.setAuthenticator()}
      onDismiss={dismissReminderBulletin}
      isHighlighted
    />
  )
}
