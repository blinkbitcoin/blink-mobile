import {
  BUNDLE_BACKSTOP_MS,
  RecoveryBundleStatus,
  statusFor,
} from "@app/self-custodial/hooks/use-recovery-bundle-status"

const NOW = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

const check = (over: Partial<Parameters<typeof statusFor>[0]> = {}) =>
  statusFor({
    savedAt: NOW - 60_000,
    savedTotalSats: "21000",
    currentTotalSats: "21000",
    now: NOW,
    ...over,
  })

describe("statusFor", () => {
  describe("no backup", () => {
    it("reports missing when nothing has ever been saved", () => {
      expect(check({ savedAt: null, savedTotalSats: null })).toBe(
        RecoveryBundleStatus.Missing,
      )
    })

    it("reports missing when the saved balance is absent", () => {
      // A state file without a recorded balance cannot be compared against the
      // wallet, so it cannot be claimed as current.
      expect(check({ savedTotalSats: null })).toBe(RecoveryBundleStatus.Missing)
    })
  })

  describe("the wallet has not changed", () => {
    it("is fresh right after a save", () => {
      expect(check()).toBe(RecoveryBundleStatus.Fresh)
    })

    it("stays fresh a week later", () => {
      // The bundle records which outputs the wallet owns. Those only change
      // when the user transacts, so an untouched wallet's backup still
      // describes it exactly - warning here would be a false alarm.
      expect(check({ savedAt: NOW - 7 * DAY })).toBe(RecoveryBundleStatus.Fresh)
    })

    it("stays fresh well past the refresh scheduler's 24h window", () => {
      // 24h is a good trigger to re-fetch and a bad claim to make to the user.
      expect(check({ savedAt: NOW - 2 * DAY })).toBe(RecoveryBundleStatus.Fresh)
    })
  })

  describe("the wallet has changed", () => {
    it("is stale when the balance grew", () => {
      expect(check({ currentTotalSats: "31000" })).toBe(RecoveryBundleStatus.Stale)
    })

    it("is stale when the balance shrank", () => {
      expect(check({ currentTotalSats: "11000" })).toBe(RecoveryBundleStatus.Stale)
    })

    it("is stale even for a backup written moments ago", () => {
      // Age is irrelevant: what matters is that the backup no longer matches.
      expect(check({ savedAt: NOW - 1000, currentTotalSats: "31000" })).toBe(
        RecoveryBundleStatus.Stale,
      )
    })

    it("does not guess while the balance is still loading", () => {
      // A null balance is "not known yet", not "changed"; claiming stale here
      // would flash a warning on every cold start.
      expect(check({ currentTotalSats: null })).toBe(RecoveryBundleStatus.Fresh)
    })
  })

  describe("age backstop", () => {
    it("goes stale past the backstop even at an unchanged balance", () => {
      // Catches what a balance comparison cannot see: a swap or consolidation
      // that moves the underlying outputs while the total stays put.
      expect(check({ savedAt: NOW - BUNDLE_BACKSTOP_MS - 1 })).toBe(
        RecoveryBundleStatus.Stale,
      )
    })

    it("treats the backstop boundary itself as stale", () => {
      expect(check({ savedAt: NOW - BUNDLE_BACKSTOP_MS })).toBe(
        RecoveryBundleStatus.Stale,
      )
    })

    it("is far longer than the refresh scheduler's fallback window", () => {
      expect(BUNDLE_BACKSTOP_MS).toBeGreaterThan(DAY)
    })

    it("treats a backwards clock as stale rather than fresh", () => {
      // Otherwise winding the date back would hide a backup from the backstop.
      expect(check({ savedAt: NOW + 60_000 })).toBe(RecoveryBundleStatus.Stale)
    })
  })
})
