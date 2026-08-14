import { gql } from "@apollo/client"

import { AccountLevel, useAccountLimitsByLevelQuery } from "@app/graphql/generated"

gql`
  query accountLimitsByLevel {
    globals {
      accountLimitsByLevel {
        level
        withdrawal
      }
    }
  }
`

// The enforced level 1 daily withdrawal limit, used when the backend value is
// unavailable (older API without accountLimitsByLevel, or a failed request).
// Matches the production config audited in blink-wip#739.
export const FALLBACK_LEVEL1_DAILY_LIMIT_CENTS = 99900

const formatUsdCents = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })

/**
 * The level 1 daily send limit as a display string (e.g. "999"), read from
 * globals.accountLimitsByLevel so copy always matches the enforced value.
 */
export const useLevel1DailyLimit = (): { limit: string } => {
  const { data } = useAccountLimitsByLevelQuery()

  const level1 = data?.globals?.accountLimitsByLevel.find(
    (limits) => limits.level === AccountLevel.One,
  )

  return {
    limit: formatUsdCents(level1?.withdrawal ?? FALLBACK_LEVEL1_DAILY_LIMIT_CENTS),
  }
}
