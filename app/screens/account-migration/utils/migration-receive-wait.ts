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
 * only once a check that started after the app came back has reached the wallet and still
 * found nothing; one that could not reach it (a dead connection on return) says nothing
 * about the funds, so it leaves the user on "on its way" rather than handing them over.
 * That is tied to the check itself rather than to a guess at how long one takes, so the
 * cadence of the checks can change without this falling out of step with it.
 */

/** Where an overdue receive hands over, from the entry and the steps alike: the delayed
 *  reason support already knows, raised from the resume path, whose Back returns to the
 *  screen the user came from. */
export const OVERDUE_RECEIVE_SUPPORT = {
  reason: MigrationSupportReason.ReceiveDelayed,
  origin: MigrationSupportOrigin.Resume,
} as const

let isReceiveOverdue = false
let foregroundedAt = Date.now()
/** When the latest check that reached the wallet began, not when it answered: one already
 *  in flight as the app went to the background may answer after it returns, on a look
 *  taken before. */
let lastAnsweredCheckStartedAt: number | null = null

/** Published by the background resume whenever its receive gate reports the wait. */
export const setMigrationReceiveOverdue = (isOverdue: boolean): void => {
  isReceiveOverdue = isOverdue
}

/** Published by the background resume each time the app becomes active, before it asks
 *  for the fresh check, so that check always counts as one taken since. */
export const markAppForegrounded = (at: number = Date.now()): void => {
  foregroundedAt = at
}

/** Published by the background resume each time a receive check reaches the wallet,
 *  whatever it found there: one that found the funds clears the overdue flag through the
 *  gate instead. */
export const markMigrationReceiveChecked = (startedAt: number): void => {
  lastAnsweredCheckStartedAt = startedAt
}

/** Back to a cold start, for when the watch that published all of this goes away: a
 *  stale wait must never outlive it. */
export const resetMigrationReceiveWait = (): void => {
  isReceiveOverdue = false
  foregroundedAt = Date.now()
  lastAnsweredCheckStartedAt = null
}

/** Past the notice window, whether or not support is due yet: what earns a hold the "taking
 *  longer than usual" wording rather than the ordinary "on its way". */
export const isMigrationReceiveOverdue = (): boolean => isReceiveOverdue

/** True once the receive is overdue and a check taken since the app last came back has
 *  reached the wallet and confirmed it is still missing. */
export const isMigrationReceiveSupportDue = (): boolean => {
  if (!isReceiveOverdue) return false
  if (lastAnsweredCheckStartedAt === null) return false
  return lastAnsweredCheckStartedAt >= foregroundedAt
}
