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
   * Drops the fee from the label until a quote lands. Keyed on the request in flight rather
   * than on a zero amount, so a fee that is genuinely zero still reads as zero instead of
   * looking like one that was never quoted.
   */
  isQuoting?: boolean
}

export const buildFeeTierOptions = ({
  tiers,
  labels,
  formatFee,
  locale,
  isQuoting = false,
}: BuildFeeTierOptionsParams) =>
  [Tier.Fast, Tier.Medium, Tier.Slow].map((tier) => {
    const info = tiers[tier]
    const label = isQuoting ? labels[tier] : `${labels[tier]} (${formatFee(info)})`

    return { id: tier, label, detail: `~ ${formatEta(info.etaMinutes, locale)}` }
  })
