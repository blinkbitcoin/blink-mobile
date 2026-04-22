import {
  type FeeTierInfo,
  type FeeTierOption,
  FeeTierOption as Tier,
} from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"

import { formatDuration } from "./date"

type FormatFeeTierParams = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  labels: Record<FeeTierOption, string>
  formatSats: (sats: number) => string
  locale: string
}

export const formatFeeTierOptions = ({
  tiers,
  labels,
  formatSats,
  locale,
}: FormatFeeTierParams) =>
  [Tier.Fast, Tier.Medium, Tier.Slow].map((tier) => {
    const info = tiers[tier]
    const feePart = formatSats(info.feeSats)
    const etaPart = formatDuration(info.etaMinutes, { unit: "minute", locale })
    return { id: tier, label: `${labels[tier]} (${feePart})`, detail: `~ ${etaPart}` }
  })
