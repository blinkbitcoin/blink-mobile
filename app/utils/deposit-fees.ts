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
 * `ratio` is in basis points; the over-threshold fee falls back to
 * DEFAULT_OVER_FEE only when the API values are not numeric — a zero ratio is
 * a legitimate "no fee" and is kept as 0.
 */
export const formatDepositFees = (
  deposit: DepositFeesInformation,
): FormattedDepositFees => {
  const fee = Number(deposit.minBankFee).toLocaleString("en-US")
  const threshold = new Intl.NumberFormat("en-US", { notation: "compact" }).format(
    Number(deposit.minBankFeeThreshold),
  )
  const computedOverFee = Math.round(
    (Number(deposit.minBankFeeThreshold) * Number(deposit.ratio)) / 10000,
  )
  const overFee = (
    Number.isFinite(computedOverFee) ? computedOverFee : DEFAULT_OVER_FEE
  ).toLocaleString("en-US")
  return { fee, threshold, overFee }
}
