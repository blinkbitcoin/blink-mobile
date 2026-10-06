import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"

/**
 * Whether a completed migration's receive is overdue, shared from the one place that
 * watches it (the background resume, mounted under the tab navigator) with the migration
 * entry and step screens, which sit beside that navigator in the root stack and so cannot
 * read a context it provides. They only ask at the moment they route, on a tap or on
 * mount, so a plain module read is enough and no subscription is needed.
 *
 * The overdue flag alone would route too eagerly after the app comes back: timers stop
 * while it is backgrounded, so the notice window can elapse unseen and the receive check
 * that would clear it only runs once the app is active again. Support is therefore due
 * only after the app has been in the foreground long enough for that check to settle.
 */

/** Where an overdue receive hands over, from the entry and the steps alike: the delayed
 *  reason support already knows, raised from the resume path, whose Back returns to the
 *  screen the user came from. */
export const OVERDUE_RECEIVE_SUPPORT = {
  reason: MigrationSupportReason.ReceiveDelayed,
  origin: MigrationSupportOrigin.Resume,
} as const

/** A receive check is a connect plus a forced sync, which takes a few seconds; this leaves
 *  room for the one that fires as soon as the app comes back. */
export const FOREGROUND_RECHECK_GRACE_MS = 15_000

let isReceiveOverdue = false
let foregroundedAt = Date.now()

/** Published by the background resume whenever its receive gate reports the wait. */
export const setMigrationReceiveOverdue = (isOverdue: boolean): void => {
  isReceiveOverdue = isOverdue
}

/** Published by the background resume each time the app becomes active. */
export const markAppForegrounded = (at: number = Date.now()): void => {
  foregroundedAt = at
}

/** True once the receive is overdue and the app has been active long enough for a fresh
 *  check to have confirmed it is still missing. */
export const isMigrationReceiveSupportDue = (now: number = Date.now()): boolean => {
  if (!isReceiveOverdue) return false
  return now - foregroundedAt >= FOREGROUND_RECHECK_GRACE_MS
}
