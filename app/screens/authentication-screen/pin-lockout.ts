// Escalating lockout after N consecutive failures: none, 10s, 30s. The failure
// after the last entry has no lockout — it logs the user out (pin-verification.ts)
// — so the number of attempts the schedule grants IS the schedule's length.
const LOCKOUT_MS_BY_FAILURES = [0, 10_000, 30_000] as const

/** Derived, so adding a tier can't silently widen the attempt budget. */
export const MAX_PIN_ATTEMPTS = LOCKOUT_MS_BY_FAILURES.length

export const MAX_LOCKOUT_MS = LOCKOUT_MS_BY_FAILURES[MAX_PIN_ATTEMPTS - 1]

export const lockoutMsForFailures = (failures: number): number =>
  LOCKOUT_MS_BY_FAILURES[Math.min(Math.max(failures, 0), MAX_PIN_ATTEMPTS - 1)]

/**
 * Bounds a persisted lock when it is loaded: a stored timestamp further out
 * than the longest scheduled lockout (wall clock rolled backward after the
 * write, or a corrupt value) is cut to now + MAX_LOCKOUT_MS, so it still
 * expires on schedule instead of locking the user out indefinitely.
 */
export const clampLockedUntil = (lockedUntil: number, now: number): number =>
  Math.min(Math.max(lockedUntil, 0), now + MAX_LOCKOUT_MS)

/**
 * Milliseconds of lockout left at `now`, floored at zero and capped at the
 * longest scheduled lockout. The cap matters while the screen stays mounted:
 * a clock that moves backward mid-lockout must not inflate a live countdown
 * past what the schedule can hand out.
 *
 * The other direction is deliberately not defended: a clock moved *forward*
 * past `lockedUntil` lifts the lock at once. Nothing in JS gives a monotonic
 * reading that survives a relaunch, so the only real fix is native elapsed-time
 * counting (Android `SystemClock.elapsedRealtime`, iOS boot-time arithmetic) —
 * out of proportion for this. What it costs is pacing, not budget: the attempt
 * count is not a clock value, so MAX_PIN_ATTEMPTS still caps total guesses at
 * three before the session ends, tampered clock or not.
 */
export const remainingLockoutMs = (lockedUntil: number, now: number): number =>
  Math.min(Math.max(0, lockedUntil - now), MAX_LOCKOUT_MS)
