const DEFAULT_MIN_BANK_FEE = 2500
const DEFAULT_THRESHOLD = 1_000_000
const DEFAULT_OVER_FEE = 5000

export type DepositFeesInformation = {
  minBankFee: string
  minBankFeeThreshold: string
  ratio: string
}

export type FormattedDepositFees = {
  fee: string
  threshold: string
  overFee: string
}

/**
 * Derives the displayed onchain deposit fees from `globals.feesInformation`.
 * `ratio` is in basis points; every field falls back to its default only when
 * the API value is not numeric — a zero ratio is a legitimate "no fee" and is
 * kept as 0.
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
  const computedOverFee = Math.round(
    (Number(deposit.minBankFeeThreshold) * Number(deposit.ratio)) / 10000,
  )
  const overFee = (
    Number.isFinite(computedOverFee) ? computedOverFee : DEFAULT_OVER_FEE
  ).toLocaleString("en-US")
  return { fee, threshold, overFee }
}
