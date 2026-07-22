import React from "react"

import { useI18nContext } from "@app/i18n/i18n-react"
import { formatDayAndMonth } from "@app/utils/date"

import { NotificationCardUI } from "../notifications/notification-card-ui"

type MigrationReminderBulletinProps = {
  /** Starts the guided migration flow; the caller owns the navigation. */
  onMigrate: () => void
  /** Wind-down final deadline as a Unix timestamp in seconds, served by the backend. */
  deadlineTimestamp: number
  /** IANA timezone the backend defines for rendering the region date. */
  timezone?: string
}

/**
 * The pre-cutoff home bulletin reminding the user to migrate before the deadline.
 * It is non-dismissible on purpose: no dismissAction is passed, so the card shows no
 * close control and only clears when the account leaves the pre-cutoff phase or migrates.
 */
export const MigrationReminderBulletin: React.FC<MigrationReminderBulletinProps> = ({
  onMigrate,
  deadlineTimestamp,
  timezone,
}) => {
  const { LL, locale } = useI18nContext()

  const deadlineDate = formatDayAndMonth({
    timestampSeconds: deadlineTimestamp,
    locale,
    timezone,
  })

  const handleMigrate = async () => onMigrate()

  return (
    <NotificationCardUI
      title={LL.AccountMigration.reminderBulletin.title()}
      text={LL.AccountMigration.reminderBulletin.body({ date: deadlineDate })}
      action={handleMigrate}
      buttonLabel={LL.AccountMigration.reminderBulletin.migrateCta()}
    />
  )
}
