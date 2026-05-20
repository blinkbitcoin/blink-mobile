import { formatDuration } from "@app/utils/date"

import {
  type FeeTierInfo,
  type FeeTierOption,
  FeeTierOption as Tier,
} from "./hooks/fee-tiers.types"

type BuildFeeTierOptionsParams = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  labels: Record<FeeTierOption, string>
  formatSats: (sats: number) => string
  locale: string
}

export const buildFeeTierOptions = ({
  tiers,
  labels,
  formatSats,
  locale,
}: BuildFeeTierOptionsParams) =>
  [Tier.Fast, Tier.Medium, Tier.Slow].map((tier) => {
    const info = tiers[tier]
    const feePart = formatSats(info.feeSats)
    const etaPart = formatDuration(info.etaMinutes, { unit: "minute", locale })
    return { id: tier, label: `${labels[tier]} (${feePart})`, detail: `~ ${etaPart}` }
  })
