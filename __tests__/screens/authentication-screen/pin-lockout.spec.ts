import {
  clampLockedUntil,
  lockoutMsForFailures,
  MAX_LOCKOUT_MS,
  remainingLockoutMs,
} from "@app/screens/authentication-screen/pin-lockout"

describe("lockoutMsForFailures", () => {
  it("escalates with consecutive failures", () => {
    expect(lockoutMsForFailures(0)).toBe(0)
    expect(lockoutMsForFailures(1)).toBe(30_000)
    expect(lockoutMsForFailures(2)).toBe(60_000)
  })

  it("caps at the last scheduled lockout", () => {
    expect(lockoutMsForFailures(3)).toBe(60_000)
    expect(lockoutMsForFailures(100)).toBe(60_000)
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
})
