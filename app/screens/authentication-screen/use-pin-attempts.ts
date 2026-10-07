import { useCallback, useEffect, useRef, useState } from "react"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import type { PinFailureState } from "@app/utils/storage/secureStorage"

import { MAX_PIN_ATTEMPTS, readPinLockState, verifyPin } from "./pin-verification"
import { useLockoutCountdown } from "./use-lockout-countdown"

type UsePinAttemptsParams = {
  /** False for the set-pin flow, which has no budget to spend and no lock. */
  readonly enabled: boolean
  readonly onUnlocked: () => void
  /** The entry did not open the lock and the keypad stays up; clear the entered digits. */
  readonly onRejected: () => void
  readonly onExhausted: () => void | Promise<void>
  readonly onUnrecorded: () => void | Promise<void>
  /** The stored PIN could not be read; no budget was spent, so invite a retry. */
  readonly onUnreadable: () => void
}

type UsePinAttempts = {
  readonly isLocked: boolean
  /** For `disabled` props. Display only — never the authority. */
  readonly isInputDisabled: boolean
  readonly remainingSeconds: number
  /** Attempts left before the session ends: null when nothing has been failed
   *  yet, zero once the budget is spent. */
  readonly attemptsRemaining: number | null
  /** Whether an entry was rejected on this screen, as opposed to a count the
   *  screen came back to: only the first is something the user just did. */
  readonly hasRejectedEntry: boolean
  /** Fire-and-forget. A call made while one is already running is dropped. */
  readonly submit: (enteredPin: string) => void
  /**
   * Its guard half is synchronous and ref-backed, so it is still correct inside
   * a handler belonging to a render that predates the verification in flight,
   * which is exactly the stale window the re-entrancy bypass used. Its other
   * half is the render's own `isInputDisabled`, which is why a lock has to be
   * in the very render that reports the outcome that started it.
   */
  readonly canAcceptInput: () => boolean
  /** The same guard, for the set-pin flow's own async completion. */
  readonly runGuarded: <T>(operation: () => Promise<T>) => Promise<T | undefined>
}

const NO_FAILURES: PinFailureState = { attempts: 0, lockedUntil: 0 }

/** Floored at zero: a lock that outlives the logout its third failure triggered
 *  keeps counting past the budget, and a count past it leaves nothing, not a
 *  negative number of attempts. */
const attemptsLeftAfter = (failures: number): number | null =>
  failures > 0 ? Math.max(0, MAX_PIN_ATTEMPTS - failures) : null

export const usePinAttempts = ({
  enabled,
  onUnlocked,
  onRejected,
  onExhausted,
  onUnrecorded,
  onUnreadable,
}: UsePinAttemptsParams): UsePinAttempts => {
  const guard = useInFlightGuard()
  const [isHydrated, setIsHydrated] = useState(!enabled)
  const [isVerifying, setIsVerifying] = useState(false)
  const [failureState, setFailureState] = useState<PinFailureState>(NO_FAILURES)
  const [hasRejectedEntry, setHasRejectedEntry] = useState(false)
  const onUnreadableRef = useRef(onUnreadable)
  onUnreadableRef.current = onUnreadable

  /** The countdown noticed its lock running longer than the schedule allows,
   *  which is a wall clock moved backward under a mounted screen. Reading the
   *  state again repairs what is stored too, so the next submit or relaunch
   *  does not impose the full wait a second time. */
  const repairLiveLock = useCallback((now: number) => {
    readPinLockState(now).then((read) => {
      if (read.status === "unreadable") {
        onUnreadableRef.current()
        return
      }
      setFailureState(read.state)
    })
  }, [])

  const {
    remainingSeconds,
    isLocked,
    resync: resyncCountdown,
  } = useLockoutCountdown(failureState, repairLiveLock)

  /** Restores what the screen *shows* after a relaunch: the countdown, and how
   *  many attempts are left. The decision itself never reads any of this, since
   *  it re-reads storage on every submit, so a slow read cannot open a window. */
  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    const hydrate = async () => {
      const read = await readPinLockState(Date.now())
      if (cancelled) return
      if (read.status === "unreadable") {
        setIsHydrated(true)
        onUnreadableRef.current()
        return
      }
      setFailureState(read.state)
      setIsHydrated(true)
    }
    hydrate()

    return () => {
      cancelled = true
    }
  }, [enabled])

  // Disabled while verifying too, so the keypad never looks live while it is
  // silently dropping presses.
  const isInputDisabled = !isHydrated || isLocked || isVerifying

  const submit = useCallback(
    (enteredPin: string) => {
      guard.run(async () => {
        setIsVerifying(true)
        const result = await verifyPin(enteredPin)

        switch (result.outcome) {
          case "unlocked":
            setFailureState(NO_FAILURES)
            setHasRejectedEntry(false)
            setIsVerifying(false)
            onUnlocked()
            return
          case "locked":
            /** Nothing was compared, so nothing was rejected: the keypad only
             *  learns of a lock it had not caught up with, and gives the entry
             *  back empty for when the wait is over. The countdown is counted
             *  again even when the state is the one already held, which is a
             *  countdown that ran out before a clock that then moved back. */
            setFailureState(result.state)
            resyncCountdown()
            setIsVerifying(false)
            onRejected()
            return
          case "wrong":
            setFailureState(result.state)
            setHasRejectedEntry(true)
            setIsVerifying(false)
            onRejected()
            return
          case "exhausted":
            // Left verifying on purpose: the guard and the disabled keypad both
            // stay put for the whole logout teardown.
            await onExhausted()
            return
          case "unreadable":
            /** Nothing counted, nothing written: leave the lock and the attempt
             *  count exactly as they were and hand the keypad back, since a
             *  retry is what recovers from a transient keystore fault. */
            setIsVerifying(false)
            onUnreadable()
            return
          case "unrecorded":
            await onUnrecorded()
        }
      })
    },
    [
      guard,
      onUnlocked,
      onRejected,
      onExhausted,
      onUnrecorded,
      onUnreadable,
      resyncCountdown,
    ],
  )

  const canAcceptInput = useCallback(
    () => !guard.isRunning() && !isInputDisabled,
    [guard, isInputDisabled],
  )

  return {
    isLocked,
    isInputDisabled,
    remainingSeconds,
    attemptsRemaining: attemptsLeftAfter(failureState.attempts),
    hasRejectedEntry,
    submit,
    canAcceptInput,
    runGuarded: guard.run,
  }
}
