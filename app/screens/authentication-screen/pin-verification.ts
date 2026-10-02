import { recordAppError } from "@app/utils/error-reporting"
import KeyStoreWrapper, { PinFailureState } from "@app/utils/storage/secureStorage"

import { clampLockedUntil, lockoutMsForFailures, remainingLockoutMs } from "./pin-lockout"

/** Consecutive wrong entries the app allows before it ends the session. */
export const MAX_PIN_ATTEMPTS = 3

/** The keys the PIN's storage faults are reported under. A key names a defect, not a call
 *  site: the first report under one silences the rest for the life of the process, so two
 *  reports share a key only when they are the same slot refusing the same operation. */
export const PinErrorKey = {
  AttemptsRead: "pin-attempts-read",
  AttemptsWrite: "pin-attempts-write",
  AttemptsClear: "pin-attempts-clear",
  PinRead: "pin-read",
} as const

export type PinVerification =
  /** A lock was still in force, so the PIN was never compared. */
  | { readonly outcome: "locked"; readonly state: PinFailureState }
  | { readonly outcome: "unlocked" }
  /** The entry was wrong and budget remains. The state carries the count it
   *  left and the lock it started. */
  | { readonly outcome: "wrong"; readonly state: PinFailureState }
  /** The attempt budget is spent. The caller must log out. */
  | { readonly outcome: "exhausted" }
  /**
   * The failed attempt could not be written down, so the next one would be
   * free. The caller must log out: see the note on failing closed below.
   */
  | { readonly outcome: "unrecorded" }
  /**
   * The stored PIN itself could not be read, so nothing was compared and no
   * budget was spent. The caller should invite a retry — see verifyPin.
   */
  | { readonly outcome: "unreadable" }

type PinLockStateRead =
  | { readonly status: "readable"; readonly state: PinFailureState }
  | { readonly status: "unreadable" }

/**
 * Reads the persisted attempt count and its lock, and bounds both.
 *
 * The count is floored and truncated, so a stored value that is negative or
 * fractional (a tampered slot, a half-written one) cannot widen the budget or
 * render as a fractional number of attempts remaining.
 *
 * A stored lock further out than its count warrants (the clock ran ahead when
 * it was written, then got corrected backward) is repaired in place, so it is
 * cut once instead of re-imposing a full wait on every single launch.
 */
export const readPinLockState = async (now: number): Promise<PinLockStateRead> => {
  const read = await KeyStoreWrapper.getPinFailureState()

  if (read.status === "failed") {
    recordAppError(new Error("PIN attempt count could not be read"), {
      alwaysRecord: true,
      dedupKey: PinErrorKey.AttemptsRead,
    })
    return { status: "unreadable" }
  }

  const stored = read.status === "found" ? read.state : { attempts: 0, lockedUntil: 0 }

  const attempts = Math.max(0, Math.trunc(stored.attempts))
  const lockedUntil = clampLockedUntil({ attempts, lockedUntil: stored.lockedUntil }, now)

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
  const lockStateRead = await readPinLockState(now)

  if (lockStateRead.status === "unreadable") {
    return { outcome: "unreadable" }
  }

  const { state } = lockStateRead

  if (remainingLockoutMs(state, now) > 0) {
    return { outcome: "locked", state }
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
      dedupKey: PinErrorKey.PinRead,
    })
    return { outcome: "unreadable" }
  }

  if (enteredPin === storedPin) {
    /** Awaited so a kill right after unlock can't leave the spent count behind.
     *  Entry is never refused over a storage fault, since the PIN was proven
     *  correct, but a clear that could not land leaves a spent budget readable,
     *  which would log this user out on their next typo, so it is reported. */
    if (!(await KeyStoreWrapper.clearPinFailureState())) {
      recordAppError(new Error("PIN attempt count could not be cleared"), {
        alwaysRecord: true,
        dedupKey: PinErrorKey.AttemptsClear,
      })
    }
    return { outcome: "unlocked" }
  }

  const failures = state.attempts + 1
  const stateAfterFailure: PinFailureState = {
    attempts: failures,
    lockedUntil: now + lockoutMsForFailures(failures),
  }

  /** Every failure is written the same way, under the cap and past it, and
   *  before anything is returned: the count and the wait it starts are one
   *  value, and a kill during whatever the caller does next must not hand
   *  either of them back. */
  const isRecorded = await KeyStoreWrapper.setPinFailureState(stateAfterFailure)

  if (failures >= MAX_PIN_ATTEMPTS) {
    /** The session ends whether or not the write landed, so the outcome does
     *  not change. What the write carries past the logout is the count and the
     *  wait the next round opens on, on a device whose lock outlives it. A
     *  write the keystore refused is worth knowing about, and it is the slot
     *  the report below is about, refusing the same write, so it goes under
     *  the same key. */
    if (!isRecorded) {
      recordAppError(new Error("Spent PIN budget could not be recorded"), {
        alwaysRecord: true,
        dedupKey: PinErrorKey.AttemptsWrite,
      })
    }
    return { outcome: "exhausted" }
  }

  if (!isRecorded) {
    /** Fail closed. A lockout held only in memory dies with the process, so a
     *  disabled keypad would be bypassed by force-quitting. Ending the session
     *  is the refusal that does not rest on the write that just failed. */
    recordAppError(new Error("PIN attempt could not be persisted"), {
      alwaysRecord: true,
      dedupKey: PinErrorKey.AttemptsWrite,
    })
    return { outcome: "unrecorded" }
  }

  return { outcome: "wrong", state: stateAfterFailure }
}
