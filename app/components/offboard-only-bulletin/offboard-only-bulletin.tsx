import React from "react"

import { useI18nContext } from "@app/i18n/i18n-react"
import { WindDownStatus } from "@app/types/wind-down"
import { formatDayAndMonth, isOnOrAfterDay } from "@app/utils/date"

import { NotificationCardUI } from "../notifications/notification-card-ui"

type OffboardOnlyBulletinProps = {
  /** The wind-down phase the copy speaks to, as the backend reports it. */
  status: WindDownStatus
  /** Wind-down final deadline as a Unix timestamp in seconds, served by the backend. */
  deadlineTimestamp: number
  /** When receiving stops, as a Unix timestamp in seconds, served by the backend. */
  receiveDisabledTimestamp: number
  /** IANA timezone the backend defines for rendering the region dates. */
  timezone?: string
}

/**
 * The home bulletin for offboard-only regions, telling the user to withdraw their
 * custodial funds before the server's deadline. It is non-dismissible and non-interactive
 * on purpose: no dismissAction, no action and no buttonLabel are passed, so the card shows
 * no close control, no button and no press feedback. Visibility is owned by
 * useOffboardOnlyBulletin.
 */
export const OffboardOnlyBulletin: React.FC<OffboardOnlyBulletinProps> = ({
  status,
  deadlineTimestamp,
  receiveDisabledTimestamp,
  timezone,
}) => {
  const { LL, locale } = useI18nContext()

  const date = formatDayAndMonth({
    timestampSeconds: deadlineTimestamp,
    locale,
    timezone,
  })

  /** Past the cutoff the receive date would read as a future event; a cutoff on or after
   *  the deadline day says nothing the deadline does not, so one date is shown. A closed
   *  account is past its cutoff too: the home only shows it while the gate is held back. */
  const body = (() => {
    if (
      status === WindDownStatus.ReceiveDisabled ||
      status === WindDownStatus.GatedClosed
    ) {
      return LL.AccountMigration.offboardBulletin.bodyReceiveOff({ date })
    }
    if (isOnOrAfterDay({ a: receiveDisabledTimestamp, b: deadlineTimestamp, timezone })) {
      return LL.AccountMigration.offboardBulletin.bodySingleDate({ date })
    }
    const receiveStopsDate = formatDayAndMonth({
      timestampSeconds: receiveDisabledTimestamp,
      locale,
      timezone,
    })
    return LL.AccountMigration.offboardBulletin.bodyTwoDates({ date, receiveStopsDate })
  })()

  return (
    <NotificationCardUI
      title={LL.AccountMigration.offboardBulletin.title()}
      text={body}
    />
  )
}
