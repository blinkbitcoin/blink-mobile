import {
  BUNDLE_STALE_AFTER_MS,
  RecoveryBundleStatus,
  statusFor,
} from "@app/self-custodial/hooks/use-recovery-bundle-status"

const NOW = 1_700_000_000_000

describe("statusFor", () => {
  it("reports missing when no bundle has ever been saved", () => {
    expect(statusFor(null, NOW)).toBe(RecoveryBundleStatus.Missing)
  })

  it("reports fresh for a bundle saved within the window", () => {
    expect(statusFor(NOW - 60_000, NOW)).toBe(RecoveryBundleStatus.Fresh)
  })

  it("reports stale once the window has passed", () => {
    expect(statusFor(NOW - BUNDLE_STALE_AFTER_MS - 1, NOW)).toBe(
      RecoveryBundleStatus.Stale,
    )
  })

  it("treats the boundary itself as stale", () => {
    // The refresh scheduler re-fetches at exactly this age, so anything older
    // is something it would already be replacing.
    expect(statusFor(NOW - BUNDLE_STALE_AFTER_MS, NOW)).toBe(RecoveryBundleStatus.Stale)
  })

  it("treats a backwards clock as stale rather than fresh", () => {
    // A wound-back device clock makes the age negative; reading that as fresh
    // would let a user hide an out-of-date backup by changing the date.
    expect(statusFor(NOW + 60_000, NOW)).toBe(RecoveryBundleStatus.Stale)
  })

  it("matches the refresh scheduler's own fallback window", () => {
    // Two different thresholds would show "up to date" while a refresh was
    // already pending.
    expect(BUNDLE_STALE_AFTER_MS).toBe(24 * 60 * 60 * 1000)
  })
})
