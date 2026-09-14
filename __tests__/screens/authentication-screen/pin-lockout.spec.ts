import {
  clampLockedUntil,
  lockoutMsForFailures,
  MAX_LOCKOUT_MS,
  MAX_PIN_ATTEMPTS,
  remainingLockoutMs,
} from "@app/screens/authentication-screen/pin-lockout"

describe("the attempt budget", () => {
  it("grants exactly one attempt per scheduled lockout tier", () => {
    // MAX_PIN_ATTEMPTS is derived from the schedule length. Adding a tier must
    // widen the budget in step, never leave the two to drift apart.
    expect(MAX_PIN_ATTEMPTS).toBe(3)
    expect(lockoutMsForFailures(MAX_PIN_ATTEMPTS - 1)).toBe(MAX_LOCKOUT_MS)
  })
})

describe("lockoutMsForFailures", () => {
  it("escalates with consecutive failures", () => {
    expect(lockoutMsForFailures(0)).toBe(0)
    expect(lockoutMsForFailures(1)).toBe(10_000)
    expect(lockoutMsForFailures(2)).toBe(30_000)
  })

  it("caps at the last scheduled lockout", () => {
    expect(lockoutMsForFailures(3)).toBe(30_000)
    expect(lockoutMsForFailures(100)).toBe(30_000)
  })

  it("treats negative input as zero failures", () => {
    expect(lockoutMsForFailures(-1)).toBe(0)
  })
})

describe("remainingLockoutMs", () => {
  it("returns the time left until the lock expires", () => {
    expect(remainingLockoutMs(10_000, 4_000)).toBe(6_000)
  })

  it("floors at zero once expired", () => {
    expect(remainingLockoutMs(10_000, 10_000)).toBe(0)
    expect(remainingLockoutMs(10_000, 50_000)).toBe(0)
  })

  it("caps at the longest scheduled lockout when the clock moves backward", () => {
    // The screen stays mounted and the wall clock steps back an hour: the live
    // countdown must not stretch past what the schedule can hand out.
    const lockedUntil = 3_600_000
    expect(remainingLockoutMs(lockedUntil, 0)).toBe(MAX_LOCKOUT_MS)
  })
})

describe("clampLockedUntil", () => {
  it("keeps a lock inside the schedule untouched", () => {
    expect(clampLockedUntil(10_000, 5_000)).toBe(10_000)
  })

  it("cuts an absurd persisted lock to now + the longest scheduled lockout", () => {
    // Clock rolled backward after the write, or a corrupt value: the lock must
    // still expire on schedule, never indefinitely.
    const now = 1_000_000
    const farFuture = now + 100 * 24 * 60 * 60 * 1000
    expect(clampLockedUntil(farFuture, now)).toBe(now + MAX_LOCKOUT_MS)
  })

  it("floors a negative persisted lock at zero", () => {
    expect(clampLockedUntil(-5_000, 1_000)).toBe(0)
  })
})
