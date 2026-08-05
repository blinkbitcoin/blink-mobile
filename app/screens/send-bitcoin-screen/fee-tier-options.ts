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
}

export const buildFeeTierOptions = ({
  tiers,
  labels,
  formatFee,
  locale,
}: BuildFeeTierOptionsParams) =>
  [Tier.Fast, Tier.Medium, Tier.Slow].map((tier) => {
    const info = tiers[tier]
    const hasFee = info.feeAmount > 0
    const label = hasFee ? `${labels[tier]} (${formatFee(info)})` : labels[tier]

    return { id: tier, label, detail: `~ ${formatEta(info.etaMinutes, locale)}` }
  })
