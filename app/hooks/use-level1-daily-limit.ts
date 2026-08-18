import { gql } from "@apollo/client"

import { AccountLevel, useAccountLimitsByLevelQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"

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

// Grouped for the reader's own language, not for English: at 999 every locale
// agrees, but a four-digit limit reads as a different number across them —
// German writes 1.500 where English writes 1,500, and a comma is German's
// decimal separator. The backend can raise the limit without a mobile release,
// so nothing would prompt a re-read of the copy when it changes.
const formatUsdCents = (cents: number, locale: string): string =>
  (cents / 100).toLocaleString(locale, { maximumFractionDigits: 2 })

/**
 * The level 1 daily send limit as a display string (e.g. "999"), read from
 * globals.accountLimitsByLevel so copy always matches the enforced value.
 */
export const useLevel1DailyLimit = (): { limit: string } => {
  const { locale } = useI18nContext()
  // cache-and-network, not the default cache-first: the Apollo cache is
  // persisted to AsyncStorage (apollo3-cache-persist in client.tsx), so a
  // cache-first read would render a stale limit on every launch after a
  // backend change — including a *lowered* limit, which is the over-promise
  // compliance failure this hook exists to prevent. The cached value still
  // renders instantly; the network response corrects it.
  const { data } = useAccountLimitsByLevelQuery({ fetchPolicy: "cache-and-network" })

  const level1 = data?.globals?.accountLimitsByLevel.find(
    (limits) => limits.level === AccountLevel.One,
  )

  return {
    limit: formatUsdCents(
      level1?.withdrawal ?? FALLBACK_LEVEL1_DAILY_LIMIT_CENTS,
      locale,
    ),
  }
}
