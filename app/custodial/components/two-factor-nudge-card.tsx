import React from "react"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TwoFactorPrompt } from "@app/types/two-factor-enforcement"

import { TwoFactorHomeCard } from "./two-factor-home-card"

/** The suggested tier's card on the home, closed for good by its X. */
export const TwoFactorNudgeCard: React.FC = () => {
  const { LL } = useI18nContext()
  const { dismissNudgeCard } = useTwoFactorEnforcement()

  return (
    <TwoFactorHomeCard
      prompt={TwoFactorPrompt.HomeCard}
      title={LL.TwoFactorEnforcement.title()}
      text={LL.TwoFactorEnforcement.cardDescription()}
      buttonLabel={LL.TwoFactorEnforcement.cardCta()}
      onDismiss={dismissNudgeCard}
    />
  )
}
