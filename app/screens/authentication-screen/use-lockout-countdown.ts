import { useCallback, useEffect, useRef, useState } from "react"

import type { PinFailureState } from "@app/utils/storage/secureStorage"

import { clampLockedUntil, remainingLockoutMs } from "./pin-lockout"

const MS_PER_SECOND = 1000

/**
 * Well under a second, so the keypad comes back just after the lock truly
 * lifts. A one-second tick would leave it dead for up to a second too long,
 * and rounding the other way would lift it early, which on a lockout is the
 * side that matters.
 */
const TICK_MS = 250

/** Ceiled, so the last partial second still reads "1" and not "0", and the lock
 *  never rounds in the user's favour: it reads zero only once nothing is left. */
const secondsLeft = (lock: PinFailureState, now: number): number =>
  Math.ceil(remainingLockoutMs(lock, now) / MS_PER_SECOND)

type LockoutCountdown = {
  readonly remainingSeconds: number
  readonly isLocked: boolean
  /** Counts the same lock again from the clock as it reads now. For a caller
   *  that learns the lock is still in force after this countdown ran out. */
  readonly resync: () => void
}

/**
 * Counts a lock down to zero. `lockedUntil` is epoch ms, 0 meaning no lock, and
 * `attempts` is the failure count the lock was started for, which is what
 * bounds it.
 *
 * Follows the two numbers in the state rather than the object, so callers need
 * no memoisation, and stops its own interval once the lock elapses. It holds
 * whole seconds, so the screen renders once a second and not once a tick.
 */
export const useLockoutCountdown = (
  { attempts, lockedUntil }: PinFailureState,
  onLockedUntilRepaired: (now: number) => void,
): LockoutCountdown => {
  const onLockedUntilRepairedRef = useRef(onLockedUntilRepaired)
  onLockedUntilRepairedRef.current = onLockedUntilRepaired

  const [countedLock, setCountedLock] = useState({ attempts, lockedUntil })
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    secondsLeft({ attempts, lockedUntil }, Date.now()),
  )
  const [resyncs, setResyncs] = useState(0)

  /** A lock that arrives with a render is counted in that same render. Left to
   *  the effect below, one frame would be committed still reporting the lock
   *  before it, and a keypad reading that frame is live for as long as it is on
   *  screen. Setting state while rendering makes React render again before it
   *  commits anything.
   *
   *  Compared with Object.is, so a number that is not one still equals itself:
   *  with `!==` it never would, and this would render without end. */
  const isSameLock =
    Object.is(countedLock.attempts, attempts) &&
    Object.is(countedLock.lockedUntil, lockedUntil)
  const isNewLock = !isSameLock
  if (isNewLock) {
    setCountedLock({ attempts, lockedUntil })
    setRemainingSeconds(secondsLeft({ attempts, lockedUntil }, Date.now()))
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    let effectiveLockedUntil = lockedUntil

    const tick = () => {
      const now = Date.now()
      const repairedLockedUntil = clampLockedUntil(
        { attempts, lockedUntil: effectiveLockedUntil },
        now,
      )
      if (repairedLockedUntil !== effectiveLockedUntil) {
        effectiveLockedUntil = repairedLockedUntil
        onLockedUntilRepairedRef.current(now)
      }
      const seconds = secondsLeft({ attempts, lockedUntil: effectiveLockedUntil }, now)
      setRemainingSeconds(seconds)
      if (seconds <= 0 && interval) clearInterval(interval)
    }

    // Once at once, so a clock that moved since the render is caught without
    // waiting a tick for it.
    tick()

    const isStillLocked =
      secondsLeft({ attempts, lockedUntil: effectiveLockedUntil }, Date.now()) > 0
    if (isStillLocked) {
      interval = setInterval(tick, TICK_MS)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [attempts, lockedUntil, resyncs])

  const resync = useCallback(() => {
    setRemainingSeconds(secondsLeft({ attempts, lockedUntil }, Date.now()))
    setResyncs((count) => count + 1)
  }, [attempts, lockedUntil])

  return {
    remainingSeconds,
    isLocked: remainingSeconds > 0,
    resync,
  }
}
