import {
  VerificationState,
  formatSurveyDate,
  isBoosted,
  verificationStateAt,
} from "@app/btcmap/verification"

const now = new Date("2026-08-14T10:00:00Z")

describe("verificationStateAt", () => {
  it("treats a place nobody has surveyed as its own state, not merely outdated", () => {
    expect(verificationStateAt(undefined, now)).toBe(VerificationState.Unsurveyed)
    expect(verificationStateAt("not-a-date", now)).toBe(VerificationState.Unsurveyed)
  })

  it("counts a survey from within the last year as current", () => {
    expect(verificationStateAt("2026-08-01", now)).toBe(VerificationState.Verified)
    expect(verificationStateAt("2025-09-01", now)).toBe(VerificationState.Verified)
  })

  it("counts a survey older than a calendar year as outdated", () => {
    expect(verificationStateAt("2025-08-13", now)).toBe(VerificationState.Outdated)
    expect(verificationStateAt("2023-03-13", now)).toBe(VerificationState.Outdated)
  })
})

describe("formatSurveyDate", () => {
  it("keeps the survey's own calendar day, not the device's", () => {
    // "2026-07-04" parses as UTC midnight; a naive format would show 3 July in
    // any negative-offset timezone.
    expect(formatSurveyDate("2026-07-04", "en-US")).toBe("July 4, 2026")
  })

  it("hands back anything it cannot parse untouched", () => {
    expect(formatSurveyDate("sometime last year", "en-US")).toBe("sometime last year")
  })
})

describe("isBoosted", () => {
  it("only counts a boost that has not expired", () => {
    expect(isBoosted("2026-09-01T00:00:00Z", now)).toBe(true)
    expect(isBoosted("2023-01-10T04:56:17.255Z", now)).toBe(false)
    expect(isBoosted(undefined, now)).toBe(false)
    expect(isBoosted("garbage", now)).toBe(false)
  })
})
