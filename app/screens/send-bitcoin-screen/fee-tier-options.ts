import { formatDuration } from "@app/utils/date"

import {
  type FeeTierInfo,
  type FeeTierOption,
  FeeTierOption as Tier,
} from "./hooks/fee-tiers.types"

const MINUTES_PER_HOUR = 60

/**
 * Renders an ETA in hours once minutes stop reading well, so the 24-hour payout queue
 * shows "24h" rather than "1440m". The switch happens above the hour rather than at it, so
 * the existing 60-minute tiers keep the "60m" they have always displayed.
 */
const formatEta = (etaMinutes: number, locale: string): string => {
  const isWholeHours =
    etaMinutes > MINUTES_PER_HOUR && etaMinutes % MINUTES_PER_HOUR === 0

  if (isWholeHours) {
    return formatDuration(etaMinutes / MINUTES_PER_HOUR, { unit: "hour", locale })
  }
  return formatDuration(etaMinutes, { unit: "minute", locale })
}

type BuildFeeTierOptionsParams = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  labels: Record<FeeTierOption, string>
  /** Receives the whole tier so the formatter reads the unit rather than assuming one. */
  formatFee: (tier: FeeTierInfo) => string
  locale: string
  /**
   * Carries the fee into the label only once a quote has landed for the inputs on screen,
   * which covers "no amount entered yet" and "quote in flight" with one predicate. Asking
   * whether a quote exists rather than whether one is running is what keeps a fee that is
   * genuinely zero reading as zero, while an unquoted tier shows no fee at all.
   */
  hasQuote: boolean
}

export const buildFeeTierOptions = ({
  tiers,
  labels,
  formatFee,
  locale,
  hasQuote,
}: BuildFeeTierOptionsParams) =>
  [Tier.Fast, Tier.Medium, Tier.Slow].map((tier) => {
    const info = tiers[tier]
    const label = hasQuote ? `${labels[tier]} (${formatFee(info)})` : labels[tier]

    return { id: tier, label, detail: `~ ${formatEta(info.etaMinutes, locale)}` }
  })
