export const MAX_PIN_ATTEMPTS = 3

// Escalating lockout after N consecutive failures: none, 30s, 60s. The third
// failure logs the user out (pin-screen.tsx), so the schedule needs no more
// entries.
const LOCKOUT_MS_BY_FAILURES = [0, 30_000, 60_000] as const

export const MAX_LOCKOUT_MS = LOCKOUT_MS_BY_FAILURES[LOCKOUT_MS_BY_FAILURES.length - 1]

export const lockoutMsForFailures = (failures: number): number =>
  LOCKOUT_MS_BY_FAILURES[
    Math.min(Math.max(failures, 0), LOCKOUT_MS_BY_FAILURES.length - 1)
  ]

/**
 * Bounds a persisted lock when it is loaded: a stored timestamp further out
 * than the longest scheduled lockout (wall clock rolled backward after the
 * write, or a corrupt value) is cut to now + MAX_LOCKOUT_MS, so it still
 * expires on schedule instead of locking the user out indefinitely.
 */
export const clampLockedUntil = (lockedUntil: number, now: number): number =>
  Math.min(lockedUntil, now + MAX_LOCKOUT_MS)

/** Milliseconds of lockout left at `now`, floored at zero. */
export const remainingLockoutMs = (lockedUntil: number, now: number): number =>
  Math.max(0, lockedUntil - now)
