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
  tiers?: readonly DepositFeeTier[] | null
}

export type FormattedDepositFees = {
  fee: string
  threshold: string
  overFee: string
}

/**
 * Derives the displayed onchain deposit fees from `globals.feesInformation`.
 * Fees are a flat amount per tier; the tier with no `maxAmount` is the
 * unbounded one charged above the threshold. Every field falls back to its
 * default only when the API value is not numeric — a zero amount is a
 * legitimate "no fee" and is kept as 0.
 */
export const formatDepositFees = (
  deposit: DepositFeesInformation,
): FormattedDepositFees => {
  const parsedFee = Number(deposit.minBankFee)
  const fee = (
    Number.isFinite(parsedFee) ? parsedFee : DEFAULT_MIN_BANK_FEE
  ).toLocaleString("en-US")
  const parsedThreshold = Number(deposit.minBankFeeThreshold)
  const threshold = new Intl.NumberFormat("en-US", { notation: "compact" }).format(
    Number.isFinite(parsedThreshold) ? parsedThreshold : DEFAULT_THRESHOLD,
  )
  const unboundedTier = deposit.tiers?.find((tier) => !tier.maxAmount)
  const parsedOverFee = Number(unboundedTier?.amount)
  const overFee = (
    Number.isFinite(parsedOverFee) ? parsedOverFee : DEFAULT_OVER_FEE
  ).toLocaleString("en-US")
  return { fee, threshold, overFee }
}
