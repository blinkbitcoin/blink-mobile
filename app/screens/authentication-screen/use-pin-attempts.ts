import { useCallback, useEffect, useRef, useState } from "react"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"

import { MAX_PIN_ATTEMPTS, readPinAttempts, verifyPin } from "./pin-verification"

type UsePinAttemptsParams = {
  /** False for the set-pin flow, which has no budget to spend. */
  readonly enabled: boolean
  readonly onUnlocked: () => void
  /** The entry was rejected but budget remains; clear the entered digits. */
  readonly onWrongPin: () => void
  readonly onExhausted: () => void | Promise<void>
  readonly onUnrecorded: () => void | Promise<void>
  /** The stored PIN could not be read; no budget was spent, so invite a retry. */
  readonly onUnreadable: () => void
}

type UsePinAttempts = {
  /** For `disabled` props. Display only — never the authority. */
  readonly isInputDisabled: boolean
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

/** Floored: a stored count above the budget (a clear that could not land) must
 *  not render as a negative number of attempts remaining. */
const attemptsLeftAfter = (failures: number): number | null =>
  failures > 0 ? Math.max(0, MAX_PIN_ATTEMPTS - failures) : null

export const usePinAttempts = ({
  enabled,
  onUnlocked,
  onWrongPin,
  onExhausted,
  onUnrecorded,
  onUnreadable,
}: UsePinAttemptsParams): UsePinAttempts => {
  const guard = useInFlightGuard()
  const [isHydrated, setIsHydrated] = useState(!enabled)
  const [isVerifying, setIsVerifying] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const onUnreadableRef = useRef(onUnreadable)
  onUnreadableRef.current = onUnreadable

  // Restores what the screen *shows* after a relaunch: how many attempts are
  // left. The decision itself never reads any of this — it re-reads storage on
  // every submit — so a slow read cannot open a window.
  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    const hydrate = async () => {
      const read = await readPinAttempts()
      if (cancelled) return
      if (read.status === "unreadable") {
        setIsHydrated(true)
        onUnreadableRef.current()
        return
      }
      setAttemptsRemaining(attemptsLeftAfter(read.state.attempts))
      setIsHydrated(true)
    }
    hydrate()

    return () => {
      cancelled = true
    }
  }, [enabled])

  // Disabled while verifying too, so the keypad never looks live while it is
  // silently dropping presses.
  const isInputDisabled = !isHydrated || isVerifying

  const submit = useCallback(
    (enteredPin: string) => {
      guard.run(async () => {
        setIsVerifying(true)
        const result = await verifyPin(enteredPin)

        switch (result.outcome) {
          case "unlocked":
            setAttemptsRemaining(null)
            setIsVerifying(false)
            onUnlocked()
            return
          case "wrong":
            setAttemptsRemaining(result.attemptsRemaining)
            setIsVerifying(false)
            onWrongPin()
            return
          case "exhausted":
            // Left verifying on purpose: the guard and the disabled keypad both
            // stay put for the whole logout teardown.
            await onExhausted()
            return
          case "unreadable":
            // Nothing counted, nothing written: leave the attempt count exactly
            // as it was and hand the keypad back, since a retry is what
            // recovers from a transient keystore fault.
            setIsVerifying(false)
            onUnreadable()
            return
          case "unrecorded":
            await onUnrecorded()
        }
      })
    },
    [guard, onUnlocked, onWrongPin, onExhausted, onUnrecorded, onUnreadable],
  )

  const canAcceptInput = useCallback(
    () => !guard.isRunning() && !isInputDisabled,
    [guard, isInputDisabled],
  )

  return {
    isInputDisabled,
    attemptsRemaining,
    submit,
    canAcceptInput,
    runGuarded: guard.run,
  }
}
