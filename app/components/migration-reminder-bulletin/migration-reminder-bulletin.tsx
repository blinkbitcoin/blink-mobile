import React from "react"

import { useI18nContext } from "@app/i18n/i18n-react"
import { WindDownStatus } from "@app/types/wind-down"
import { formatDayAndMonth } from "@app/utils/date"

import { NotificationCardUI } from "../notifications/notification-card-ui"

type MigrationReminderBulletinProps = {
  /** Starts the guided migration flow; the caller owns the navigation. */
  onMigrate: () => void
  /** The wind-down phase the copy speaks to: receiving still ahead, or already stopped. */
  phase: WindDownStatus
  /** Wind-down final deadline as a Unix timestamp in seconds, served by the backend. */
  deadlineTimestamp: number
  /** When receiving stops, as a Unix timestamp in seconds, served by the backend. */
  receiveDisabledTimestamp: number
  /** IANA timezone the backend defines for rendering the region date. */
  timezone?: string
}

/**
 * The home bulletin reminding the user to migrate before the deadline, in the two phases
 * where the migration is still reachable from the dashboard. It is non-dismissible on
 * purpose: no dismissAction is passed, so the card shows no close control and only clears
 * when the account leaves those phases or migrates.
 */
export const MigrationReminderBulletin: React.FC<MigrationReminderBulletinProps> = ({
  onMigrate,
  phase,
  deadlineTimestamp,
  receiveDisabledTimestamp,
  timezone,
}) => {
  const { LL, locale } = useI18nContext()

  const deadlineDate = formatDayAndMonth({
    timestampSeconds: deadlineTimestamp,
    locale,
    timezone,
  })

  const receiveStopsDate = formatDayAndMonth({
    timestampSeconds: receiveDisabledTimestamp,
    locale,
    timezone,
  })

  /** Announcing when receiving stops is only informative while it still has not: past the
   *  cutoff the same sentence reads as a future event, dated before the day it is read. */
  const isReceiveDisabled = phase === WindDownStatus.ReceiveDisabled
  const bulletinBody = isReceiveDisabled
    ? LL.AccountMigration.reminderBulletin.bodyReceiveDisabled({ date: deadlineDate })
    : LL.AccountMigration.reminderBulletin.body({
        date: deadlineDate,
        receiveStopsDate,
      })

  const handleMigrate = async () => onMigrate()

  return (
    <NotificationCardUI
      title={LL.AccountMigration.reminderBulletin.title()}
      text={bulletinBody}
      action={handleMigrate}
      buttonLabel={LL.AccountMigration.reminderBulletin.migrateCta()}
    />
  )
}
