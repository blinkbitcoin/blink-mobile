import React from "react"
import { useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"

import { InfoCard } from "./info-card"

/** Invites an address that is not the member's home, as a friendly note (D42, D123). */
export const PrivacyTipCard: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const privacyTipLL = LL.CardFlow.ShippingAddress.PrivacyTip

  return (
    <InfoCard
      title={privacyTipLL.title()}
      description={privacyTipLL.description()}
      icon="eye-slash"
      titleColor={colors.success}
      iconColor={colors.success}
      size="lg"
    />
  )
}
