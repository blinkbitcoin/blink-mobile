import { useEffect, useRef, useState } from "react"

import { clampLockedUntil, remainingLockoutMs } from "./pin-lockout"

/**
 * Well under a second, so the keypad comes back just after the lock truly
 * lifts. A one-second tick would leave it dead for up to a second too long,
 * and rounding the other way would lift it early — which on a lockout is the
 * side that matters.
 */
const TICK_MS = 250

type LockoutCountdown = {
  /** Millisecond-precise, so the lock never rounds in the user's favour. */
  readonly remainingMs: number
  /** Ceiled, so the last partial second still reads "1" and not "0". */
  readonly remainingSeconds: number
  readonly isLocked: boolean
}

/**
 * Counts a lock down to zero. `lockedUntil` is epoch ms, 0 meaning no lock.
 *
 * Takes a number rather than a Date so callers need no memoisation, and stops
 * its own interval once the lock elapses.
 */
export const useLockoutCountdown = (
  lockedUntil: number,
  onLockedUntilRepaired?: (now: number) => void,
): LockoutCountdown => {
  const onLockedUntilRepairedRef = useRef(onLockedUntilRepaired)
  onLockedUntilRepairedRef.current = onLockedUntilRepaired

  const [remainingMs, setRemainingMs] = useState(() =>
    remainingLockoutMs(lockedUntil, Date.now()),
  )

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    let effectiveLockedUntil = lockedUntil

    const tick = () => {
      const now = Date.now()
      const repairedLockedUntil = clampLockedUntil(effectiveLockedUntil, now)
      if (repairedLockedUntil !== effectiveLockedUntil) {
        effectiveLockedUntil = repairedLockedUntil
        onLockedUntilRepairedRef.current?.(now)
      }
      const remaining = remainingLockoutMs(effectiveLockedUntil, now)
      setRemainingMs(remaining)
      if (remaining <= 0 && interval) clearInterval(interval)
    }

    // Resync immediately, so a fresh lock never renders a stale value first.
    tick()

    if (remainingLockoutMs(effectiveLockedUntil, Date.now()) > 0) {
      interval = setInterval(tick, TICK_MS)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [lockedUntil])

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isLocked: remainingMs > 0,
  }
}
