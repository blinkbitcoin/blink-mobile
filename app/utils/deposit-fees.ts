const DEFAULT_MIN_BANK_FEE = 2500
const DEFAULT_THRESHOLD = 1_000_000
const DEFAULT_OVER_FEE = 5000

export type DepositFeeTier = {
  maxAmount?: string | null
  amount: string
}

export type DepositFeesInformation = {
  minBankFee: string
  minBankFeeThreshold: string
  tiers: readonly DepositFeeTier[]
}

export type FormattedDepositFeeTier = {
  /** Flat fee charged in this tier, e.g. "2,500". */
  amount: string
  /** Compact lower bound, e.g. "1M". Null on the first tier. */
  minAmount: string | null
  /** Compact upper bound, e.g. "1M". Null on the unbounded tier. */
  maxAmount: string | null
}

type ParsedTier = {
  amount: number
  maxAmount: number | null
}

const toNumber = (value?: string | null): number | null => {
  if (value === null || value === undefined || value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const compact = (value: number): string =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(value)

/**
 * The shape the API exposed before flat per-tier fees: `minBankFee` up to
 * `minBankFeeThreshold`, a default above it. Only reached when `tiers` is
 * empty or unusable, so the screens never render a bare "no fee".
 */
const fallbackTiers = (deposit: DepositFeesInformation): ParsedTier[] => [
  {
    amount: toNumber(deposit.minBankFee) ?? DEFAULT_MIN_BANK_FEE,
    maxAmount: toNumber(deposit.minBankFeeThreshold) ?? DEFAULT_THRESHOLD,
  },
  { amount: DEFAULT_OVER_FEE, maxAmount: null },
]

const parseTiers = (deposit: DepositFeesInformation): ParsedTier[] => {
  const parsed = deposit.tiers
    .map((tier) => ({
      amount: toNumber(tier.amount),
      maxAmount: toNumber(tier.maxAmount),
    }))
    .filter((tier): tier is ParsedTier => tier.amount !== null)
    // The API sorts ascending with the unbounded tier last; sorting here keeps
    // the rendered bounds coherent even if that ever stops holding.
    .sort((a, b) => (a.maxAmount ?? Infinity) - (b.maxAmount ?? Infinity))

  return parsed.length > 0 ? parsed : fallbackTiers(deposit)
}

/**
 * Derives the displayed onchain deposit fees from `globals.feesInformation`.
 * Fees are a flat amount per tier; the tier with no `maxAmount` is the
 * unbounded one. Both bounds of a tier come from the tier list itself, so a
 * label can never disagree with the amount beside it, and a zero amount stays
 * a legitimate "no fee" rather than being treated as missing.
 */
export const formatDepositFeeTiers = (
  deposit: DepositFeesInformation,
): FormattedDepositFeeTier[] => {
  const tiers = parseTiers(deposit)

  return tiers.map((tier, index) => {
    const previousMax = index > 0 ? tiers[index - 1].maxAmount : null
    return {
      amount: tier.amount.toLocaleString("en-US"),
      minAmount: previousMax === null ? null : compact(previousMax),
      maxAmount: tier.maxAmount === null ? null : compact(tier.maxAmount),
    }
  })
}

export const DepositFeeWarning = {
  BelowMinimum: "belowMinimum",
  AllConsumedByFee: "allConsumedByFee",
  ConsumedByFee: "consumedByFee",
} as const

export type DepositFeeWarningType =
  (typeof DepositFeeWarning)[keyof typeof DepositFeeWarning]

/**
 * The flat fee the backend charges a deposit of `amountSats`: the first tier
 * whose `maxAmount` covers it, inclusive like the backend's tiered strategy.
 * Before `feesInformation` resolves it is the default minimum bank fee.
 */
export const depositFeeForAmount = (
  amountSats: number,
  deposit?: DepositFeesInformation,
): number => {
  if (!deposit) return DEFAULT_MIN_BANK_FEE
  const tiers = parseTiers(deposit)
  const tier = tiers.find(
    ({ maxAmount }) => maxAmount === null || amountSats <= maxAmount,
  )
  return (tier ?? tiers[tiers.length - 1]).amount
}

/**
 * Classifies an onchain receive amount the way the backend settles it. It
 * drops a deposit under `minimumSats` (its dust threshold) before any fee,
 * with no record at all, so that check comes first. It also drops one the
 * fee would leave nothing of (`AmountLessThanFeeError` when the credit is
 * `<= 0`, so an amount equal to the fee too). Under `multiplier` times the fee
 * it arrives with most of it gone. An empty or zero amount never warns.
 */
export const getDepositFeeWarning = ({
  amountSats,
  deposit,
  minimumSats,
  multiplier,
}: {
  amountSats: number
  deposit?: DepositFeesInformation
  minimumSats: number
  multiplier: number
}): { type: DepositFeeWarningType; fee: number; minimum: number } | null => {
  if (amountSats <= 0) return null
  const fee = depositFeeForAmount(amountSats, deposit)
  const warning = (type: DepositFeeWarningType) => ({ type, fee, minimum: minimumSats })
  if (amountSats < minimumSats) return warning(DepositFeeWarning.BelowMinimum)
  if (amountSats <= fee) return warning(DepositFeeWarning.AllConsumedByFee)
  if (amountSats < fee * multiplier) return warning(DepositFeeWarning.ConsumedByFee)
  return null
}
