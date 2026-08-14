import React from "react"

import { useI18nContext } from "@app/i18n/i18n-react"

import { NotificationCardUI } from "../notifications/notification-card-ui"

/**
 * The home bulletin for offboard-only regions, telling the user to withdraw their
 * custodial funds. It is non-dismissible and non-interactive on purpose: no dismissAction,
 * no action and no buttonLabel are passed, so the card shows no close control, no button
 * and no press feedback. Visibility is owned by useOffboardOnlyBulletin.
 */
export const OffboardOnlyBulletin: React.FC = () => {
  const { LL } = useI18nContext()

  return (
    <NotificationCardUI
      title={LL.AccountMigration.offboardBulletin.title()}
      text={LL.AccountMigration.offboardBulletin.body()}
    />
  )
}
