import type { PinFailureState } from "@app/utils/storage/secureStorage"

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS

/**
 * How long the keypad stays shut after each consecutive failure, the first
 * failure first. The last entry repeats for every failure past the table.
 *
 * The first two are a nudge: the attempt budget is what stops a guesser there,
 * and one typo should cost seconds. From the third on, the budget is spent and
 * the session is gone, but on a device whose lock outlives that logout the PIN
 * is still there to guess against. The wait is then the only thing pacing the
 * guesses, so it grows fast and stays long.
 */
const LOCKOUT_MS_BY_FAILURE = [
  10 * SECOND_MS,
  30 * SECOND_MS,
  MINUTE_MS,
  5 * MINUTE_MS,
  15 * MINUTE_MS,
  60 * MINUTE_MS,
] as const

/** Whole failures only: a count that is fractional or not a number would index
 *  past the table and come back as no wait at all, so it is truncated here, and
 *  anything short of one failure asks for none. */
export const lockoutMsForFailures = (failures: number): number => {
  const hasFailed = failures >= 1
  if (!hasFailed) return 0
  const lastTier = LOCKOUT_MS_BY_FAILURE.length - 1
  return LOCKOUT_MS_BY_FAILURE[Math.min(Math.trunc(failures) - 1, lastTier)]
}

/**
 * Bounds a lock by the wait its own failure count warrants.
 *
 * A lock is written as now + that wait, so one read back further out than
 * that proves the clock moved backward after the write, or that the value is
 * not one this schedule wrote. It is cut to a full wait from now, so it still
 * expires on schedule instead of standing for as long as the clock was off.
 */
export const clampLockedUntil = (
  { attempts, lockedUntil }: PinFailureState,
  now: number,
): number => Math.min(Math.max(lockedUntil, 0), now + lockoutMsForFailures(attempts))

/**
 * Milliseconds of lockout left at `now`, floored at zero and bounded as above.
 *
 * The other direction is deliberately not defended: a clock moved *forward*
 * past `lockedUntil` lifts the lock at once. Nothing in JS gives a monotonic
 * reading that survives a relaunch, so closing that takes elapsed time counted
 * natively (Android `SystemClock.elapsedRealtime`, iOS boot-time arithmetic).
 * Under the cap it costs pacing and not budget, since the attempt count is not
 * a clock value. Past the cap pacing is all there is, so there it is the limit
 * of what a wall clock can enforce.
 */
export const remainingLockoutMs = (state: PinFailureState, now: number): number =>
  Math.max(0, clampLockedUntil(state, now) - now)
