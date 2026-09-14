import { recordAppError } from "@app/utils/error-reporting"
import KeyStoreWrapper, { PinFailureState } from "@app/utils/storage/secureStorage"

import {
  clampLockedUntil,
  lockoutMsForFailures,
  MAX_PIN_ATTEMPTS,
  remainingLockoutMs,
} from "./pin-lockout"

export type PinVerification =
  /** A lock was still in force, so the PIN was never compared. */
  | { readonly outcome: "locked"; readonly lockedUntil: number }
  | { readonly outcome: "unlocked" }
  | {
      readonly outcome: "wrong"
      readonly attemptsRemaining: number
      readonly lockedUntil: number
    }
  /** The attempt budget is spent. The caller must log out. */
  | { readonly outcome: "exhausted" }
  /**
   * The failed attempt could not be written down, so the next one would be
   * free. The caller must log out — see the note on failing closed below.
   */
  | { readonly outcome: "unrecorded" }
  /**
   * The stored PIN itself could not be read, so nothing was compared and no
   * budget was spent. The caller should invite a retry — see verifyPin.
   */
  | { readonly outcome: "unreadable" }

export type PinLockStateRead =
  | { readonly status: "readable"; readonly state: PinFailureState }
  | { readonly status: "unreadable" }

/**
 * Reads the persisted lockout and bounds it.
 *
 * A stored lock further out than the schedule allows (the clock ran ahead when
 * it was written, then got corrected backward) is repaired in place, so it is
 * cut once instead of re-imposing the full lockout on every single launch.
 */
export const readPinLockState = async (now: number): Promise<PinLockStateRead> => {
  const read = await KeyStoreWrapper.getPinFailureState()

  if (read.status === "failed") {
    recordAppError(new Error("PIN lockout state could not be read"), {
      alwaysRecord: true,
      dedupKey: "pin-lockout-read",
    })
    return { status: "unreadable" }
  }

  const stored = read.status === "found" ? read.state : { attempts: 0, lockedUntil: 0 }

  const attempts = Math.max(0, Math.trunc(stored.attempts))
  const lockedUntil = clampLockedUntil(stored.lockedUntil, now)

  if (lockedUntil !== stored.lockedUntil) {
    await KeyStoreWrapper.setPinFailureState({ attempts, lockedUntil })
  }

  return { status: "readable", state: { attempts, lockedUntil } }
}

/**
 * The single authority on whether an entered PIN opens the app.
 *
 * Every input to the decision is read from storage at call time, never from
 * React state. That is what makes the lockout survive a relaunch: a
 * verification racing the screen's own hydration still sees the true failure
 * count, so it can neither skip an active lock nor overwrite a higher count
 * with a lower one.
 *
 * `now` is a parameter so callers and tests can pin the clock exactly.
 */
export const verifyPin = async (
  enteredPin: string,
  now: number = Date.now(),
): Promise<PinVerification> => {
  const lockState = await readPinLockState(now)

  if (lockState.status === "unreadable") {
    return { outcome: "unreadable" }
  }

  const { attempts, lockedUntil } = lockState.state

  if (remainingLockoutMs(lockedUntil, now) > 0) {
    return { outcome: "locked", lockedUntil }
  }

  const storedPin = await KeyStoreWrapper.getPin()

  // A keystore fault and a PIN that is not there arrive identically, and
  // neither is something the user did: scoring it as a wrong entry would spend
  // the budget — and eventually the session and the PIN — of someone who typed
  // nothing wrong. Nothing is written, so a retry costs the attacker nothing
  // either; what stops them is the same budget, still intact.
  if (storedPin === null || storedPin.length === 0) {
    recordAppError(new Error("PIN could not be read"), {
      alwaysRecord: true,
      dedupKey: "pin-read",
    })
    return { outcome: "unreadable" }
  }

  if (enteredPin === storedPin) {
    // Awaited so a kill right after unlock can't leave a stale future lock.
    // Entry is never refused over a storage fault — the PIN was proven correct
    // — but a clear that could not land leaves a spent budget readable, which
    // would log this user out on their next typo, so it is reported.
    if (!(await KeyStoreWrapper.clearPinFailureState())) {
      recordAppError(new Error("PIN lockout state could not be cleared"), {
        alwaysRecord: true,
        dedupKey: "pin-lockout-clear",
      })
    }
    return { outcome: "unlocked" }
  }

  const failures = attempts + 1

  if (failures >= MAX_PIN_ATTEMPTS) {
    // Recorded before returning, so a kill during the logout that follows
    // cannot hand back a spent budget.
    await KeyStoreWrapper.setPinFailureState({ attempts: failures, lockedUntil: 0 })
    return { outcome: "exhausted" }
  }

  const newLockedUntil = now + lockoutMsForFailures(failures)
  const persisted = await KeyStoreWrapper.setPinFailureState({
    attempts: failures,
    lockedUntil: newLockedUntil,
  })

  if (!persisted) {
    // Fail closed. A lockout held only in memory dies with the process, so a
    // disabled keypad would be bypassed by force-quitting. Logging out is the
    // only refusal that survives a relaunch.
    recordAppError(new Error("PIN lockout could not be persisted"), {
      alwaysRecord: true,
      dedupKey: "pin-lockout-write",
    })
    return { outcome: "unrecorded" }
  }

  return {
    outcome: "wrong",
    attemptsRemaining: MAX_PIN_ATTEMPTS - failures,
    lockedUntil: newLockedUntil,
  }
}
