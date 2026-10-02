import { it } from "@jest/globals"

import {
  clampLockedUntil,
  lockoutMsForFailures,
  remainingLockoutMs,
} from "@app/screens/authentication-screen/pin-lockout"
import { MAX_PIN_ATTEMPTS } from "@app/screens/authentication-screen/pin-verification"

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS

describe("lockoutMsForFailures", () => {
  it.each([
    [1, 10 * SECOND_MS],
    [2, 30 * SECOND_MS],
    [3, MINUTE_MS],
    [4, 5 * MINUTE_MS],
    [5, 15 * MINUTE_MS],
    [6, 60 * MINUTE_MS],
  ])("escalates with consecutive failures: failure %i waits %i ms", (failures, wait) => {
    expect(lockoutMsForFailures(failures)).toBe(wait)
  })

  it("keeps growing past the attempt budget, where the wait is all that paces a guess", () => {
    /** The third failure spends the budget. On a device whose lock outlives the logout
     *  that follows, the next guess must cost more than the one before it, not less. */
    const spendingFailure = MAX_PIN_ATTEMPTS

    expect(lockoutMsForFailures(spendingFailure)).toBeGreaterThan(
      lockoutMsForFailures(spendingFailure - 1),
    )
    expect(lockoutMsForFailures(spendingFailure + 1)).toBeGreaterThan(
      lockoutMsForFailures(spendingFailure),
    )
  })

  it("repeats the longest wait for every failure past the table", () => {
    expect(lockoutMsForFailures(7)).toBe(60 * MINUTE_MS)
    expect(lockoutMsForFailures(100)).toBe(60 * MINUTE_MS)
  })

  it("asks for no wait when nothing has been failed", () => {
    expect(lockoutMsForFailures(0)).toBe(0)
    expect(lockoutMsForFailures(-1)).toBe(0)
    expect(lockoutMsForFailures(0.9)).toBe(0)
  })

  it("never answers with something that is not a wait", () => {
    /** A count that is fractional or not a number would index past the table. Read as no
     *  number at all, the wait would compare as elapsed and the lock would never hold. */
    expect(lockoutMsForFailures(2.5)).toBe(30 * SECOND_MS)
    expect(lockoutMsForFailures(Number.NaN)).toBe(0)
    expect(remainingLockoutMs({ attempts: 2.5, lockedUntil: 20_000 }, 0)).toBe(20_000)
  })
})

describe("clampLockedUntil", () => {
  it("keeps a lock inside its own wait untouched", () => {
    expect(clampLockedUntil({ attempts: 1, lockedUntil: 10_000 }, 5_000)).toBe(10_000)
  })

  it("cuts a lock further out than its failure count warrants to a full wait from now", () => {
    /** Clock rolled backward after the write, or a value this schedule never wrote: the
     *  lock must still expire on schedule, and on the schedule of the failure it sits
     *  with, not of the longest one. */
    const now = 1_000_000
    const farFuture = now + 100 * 24 * 60 * MINUTE_MS

    expect(clampLockedUntil({ attempts: 1, lockedUntil: farFuture }, now)).toBe(
      now + 10 * SECOND_MS,
    )
    expect(clampLockedUntil({ attempts: 4, lockedUntil: farFuture }, now)).toBe(
      now + 5 * MINUTE_MS,
    )
  })

  it("leaves an expired lock where it was", () => {
    expect(clampLockedUntil({ attempts: 2, lockedUntil: 4_000 }, 50_000)).toBe(4_000)
  })

  it("floors a negative lock at zero", () => {
    expect(clampLockedUntil({ attempts: 1, lockedUntil: -5_000 }, 1_000)).toBe(0)
  })

  it("grants no lock to a count of zero, whatever was stored beside it", () => {
    const now = 1_000_000

    expect(clampLockedUntil({ attempts: 0, lockedUntil: now + 30_000 }, now)).toBe(now)
    expect(remainingLockoutMs({ attempts: 0, lockedUntil: now + 30_000 }, now)).toBe(0)
  })
})

describe("remainingLockoutMs", () => {
  it("returns the time left until the lock expires", () => {
    expect(remainingLockoutMs({ attempts: 1, lockedUntil: 10_000 }, 4_000)).toBe(6_000)
  })

  it("floors at zero once expired", () => {
    expect(remainingLockoutMs({ attempts: 1, lockedUntil: 10_000 }, 10_000)).toBe(0)
    expect(remainingLockoutMs({ attempts: 1, lockedUntil: 10_000 }, 50_000)).toBe(0)
  })

  it("never exceeds the wait of its own failure count when the clock moves backward", () => {
    /** The screen stays mounted and the wall clock steps back an hour: the countdown must
     *  not stretch past what that failure was given. */
    const lockedUntil = 60 * MINUTE_MS

    expect(remainingLockoutMs({ attempts: 2, lockedUntil }, 0)).toBe(30 * SECOND_MS)
  })
})
