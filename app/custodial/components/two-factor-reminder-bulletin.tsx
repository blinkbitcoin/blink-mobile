import React from "react"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  TwoFactorPrompt,
  TwoFactorReminderReason,
} from "@app/types/two-factor-enforcement"

import { TwoFactorHomeCard } from "./two-factor-home-card"

type TwoFactorReminderBulletinProps = {
  /** Why the bulletin is up, which its events report. */
  reason: TwoFactorReminderReason
}

/**
 * The reminder tier's bulletin on the home: the card, styled as every other home
 * bulletin, and always the same, whether it is one of the first sessions or a new
 * all-time high that brought it back. It never says how often it comes back. Its button
 * names the authenticator and opens its onboarding, where leaving unfinished is the
 * session's dismissal, as the X here is.
 */
export const TwoFactorReminderBulletin: React.FC<TwoFactorReminderBulletinProps> = ({
  reason,
}) => {
  const { LL } = useI18nContext()
  const { dismissReminderBulletin } = useTwoFactorEnforcement()

  return (
    <TwoFactorHomeCard
      prompt={TwoFactorPrompt.ReminderBulletin}
      destination="totpRegistrationIntro"
      reason={reason}
      title={LL.TwoFactorEnforcement.reminderTitle()}
      text={LL.TwoFactorEnforcement.reminderDescription()}
      buttonLabel={LL.TwoFactorEnforcement.setAuthenticator()}
      onDismiss={dismissReminderBulletin}
    />
  )
}
