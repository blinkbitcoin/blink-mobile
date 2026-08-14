// BTC Map places are surveyed by volunteers, and a survey goes stale. btcmap.org
// draws the line at one calendar year and nags for a re-survey past it; we show
// the same three states so a pin that says "accepts bitcoin" carries the same
// amount of doubt here as it does there.

export const VerificationState = {
  // Surveyed within the last year.
  Verified: "verified",
  // Surveyed, but longer ago than that.
  Outdated: "outdated",
  // Never surveyed.
  Unsurveyed: "unsurveyed",
} as const

export type VerificationState = (typeof VerificationState)[keyof typeof VerificationState]

export const verificationStateAt = (
  verifiedAt: string | undefined,
  now: Date,
): VerificationState => {
  if (!verifiedAt) return VerificationState.Unsurveyed

  const surveyedAt = new Date(verifiedAt).getTime()
  if (Number.isNaN(surveyedAt)) return VerificationState.Unsurveyed

  // Calendar-year arithmetic, matching btcmap.org — not a fixed 365 days, so
  // the boundary shifts by a day across a leap year.
  const cutoff = new Date(now.getTime())
  cutoff.setFullYear(cutoff.getFullYear() - 1)

  return surveyedAt > cutoff.getTime()
    ? VerificationState.Verified
    : VerificationState.Outdated
}

/**
 * `verified_at` arrives as a plain "YYYY-MM-DD" survey date, with no time and no
 * zone. Parsing that with `new Date` puts it at UTC midnight, which in a
 * negative-offset timezone renders as the day before — so it is formatted from
 * its own calendar parts rather than the device's.
 */
export const formatSurveyDate = (verifiedAt: string, locale: string): string => {
  const parsed = new Date(verifiedAt)
  if (Number.isNaN(parsed.getTime())) return verifiedAt

  const asLocalMidnight = new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  )

  return asLocalMidnight.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export const isBoosted = (boostedUntil: string | undefined, now: Date): boolean => {
  if (!boostedUntil) return false
  const expiresAt = new Date(boostedUntil).getTime()
  return !Number.isNaN(expiresAt) && expiresAt > now.getTime()
}
