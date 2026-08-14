import { useCallback, useEffect, useState } from "react"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"

import { MAX_PIN_ATTEMPTS } from "./pin-lockout"
import { readPinLockState, verifyPin } from "./pin-verification"
import { useLockoutCountdown } from "./use-lockout-countdown"

type UsePinLockoutParams = {
  /** False for the set-pin flow, which is never subject to a lockout. */
  readonly enabled: boolean
  readonly onUnlocked: () => void
  /** The entry was rejected but budget remains; clear the entered digits. */
  readonly onWrongPin: () => void
  readonly onExhausted: () => void | Promise<void>
  readonly onUnrecorded: () => void | Promise<void>
}

type UsePinLockout = {
  readonly isLocked: boolean
  /** For `disabled` props. Display only — never the authority. */
  readonly isInputDisabled: boolean
  readonly remainingSeconds: number
  /** Attempts left before logout, or null when nothing has been failed yet. */
  readonly attemptsRemaining: number | null
  /** Fire-and-forget. A call made while one is already running is dropped. */
  readonly submit: (enteredPin: string) => void
  /**
   * Synchronous and ref-backed, so it is still correct inside a handler
   * belonging to a render that predates the verification in flight — which is
   * exactly the stale window the re-entrancy bypass used.
   */
  readonly canAcceptInput: () => boolean
  /** The same guard, for the set-pin flow's own async completion. */
  readonly runGuarded: <T>(operation: () => Promise<T>) => Promise<T | undefined>
}

const attemptsLeftAfter = (failures: number): number | null =>
  failures > 0 ? MAX_PIN_ATTEMPTS - failures : null

export const usePinLockout = ({
  enabled,
  onUnlocked,
  onWrongPin,
  onExhausted,
  onUnrecorded,
}: UsePinLockoutParams): UsePinLockout => {
  const guard = useInFlightGuard()
  const [isHydrated, setIsHydrated] = useState(!enabled)
  const [isVerifying, setIsVerifying] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  const { remainingSeconds, isLocked } = useLockoutCountdown(enabled ? lockedUntil : 0)

  // Restores what the screen *shows* after a relaunch: the countdown, and how
  // many attempts are left. The decision itself never reads any of this — it
  // re-reads storage on every submit — so a slow read cannot open a window.
  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    const hydrate = async () => {
      const state = await readPinLockState(Date.now())
      if (cancelled) return
      setLockedUntil(state.lockedUntil)
      setAttemptsRemaining(attemptsLeftAfter(state.attempts))
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
            setLockedUntil(0)
            setAttemptsRemaining(null)
            setIsVerifying(false)
            onUnlocked()
            return
          case "locked":
            setLockedUntil(result.lockedUntil)
            setIsVerifying(false)
            return
          case "wrong":
            setLockedUntil(result.lockedUntil)
            setAttemptsRemaining(result.attemptsRemaining)
            setIsVerifying(false)
            onWrongPin()
            return
          case "exhausted":
            // Left verifying on purpose: the guard and the disabled keypad both
            // stay put for the whole logout teardown.
            await onExhausted()
            return
          case "unrecorded":
            await onUnrecorded()
        }
      })
    },
    [guard, onUnlocked, onWrongPin, onExhausted, onUnrecorded],
  )

  const canAcceptInput = useCallback(
    () => !guard.isRunning() && !isInputDisabled,
    [guard, isInputDisabled],
  )

  return {
    isLocked,
    isInputDisabled,
    remainingSeconds,
    attemptsRemaining,
    submit,
    canAcceptInput,
    runGuarded: guard.run,
  }
}
