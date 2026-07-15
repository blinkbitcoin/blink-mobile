/**
 * TODO: TEMPORARY mock of the backend migration preview: the fee/drain math below mirrors
 * the backend so the balance summary renders correct numbers until the real preview query
 * ships. The wind-down status is served by the real `Query.windDown`, not mocked here.
 * The durable contract types live in @app/types/wind-down.
 */
import { AccountMigrationPreview } from "@app/types/wind-down"

/** Backend FEECAP_BASIS_POINTS: the fee reserve percentage, 50 bps = 0.5%. */
const FEE_CAP_BASIS_POINTS = 50
const BASIS_POINTS_DIVISOR = 10_000
/** Backend FEECAP_MIN: the reserve floor in sats, which micro payments always pay. */
const MINIMUM_FEE_SATS = 10
/** Backend de-minimis threshold: balances at or below it migrate with the fee on Blink. */
const DE_MINIMIS_THRESHOLD_SATS = 100

/**
 * Replicates the backend fee reserve (LnFees().maxProtocolAndBankFee) for a candidate
 * transfer amount: max(0.5% of the amount, 10 sats). The percentage rounds half-DOWN
 * (the backend divides bigints and only rounds up when the remainder strictly exceeds
 * half the divisor), so this mirrors that instead of using Math.round.
 */
const reserveForAmount = (amountSats: number): number => {
  const scaled = amountSats * FEE_CAP_BASIS_POINTS
  const quotient = Math.floor(scaled / BASIS_POINTS_DIVISOR)
  const remainder = scaled % BASIS_POINTS_DIVISOR
  const shouldRoundUp = remainder > BASIS_POINTS_DIVISOR / 2
  const percentageFee = shouldRoundUp ? quotient + 1 : quotient
  return Math.max(percentageFee, MINIMUM_FEE_SATS)
}

/**
 * Replicates the backend drain solve (migrationDrainAmount): the largest amount A that
 * still fits with its own reserve inside the balance, A + reserve(A) <= B. Seeded with
 * the closed forms of both fee regimes (whichever is smaller never overshoots), then
 * closed upward against the live reserve function, exactly like the backend loop.
 */
const drainAmountForBalance = (balanceSats: number): number => {
  const flatRegimeSeed = balanceSats - MINIMUM_FEE_SATS
  const percentageRegimeSeed = Math.floor(
    (BASIS_POINTS_DIVISOR * balanceSats) / (BASIS_POINTS_DIVISOR + FEE_CAP_BASIS_POINTS),
  )
  let amount = Math.min(flatRegimeSeed, percentageRegimeSeed)
  while (amount + 1 + reserveForAmount(amount + 1) <= balanceSats) {
    amount += 1
  }
  return amount
}

/**
 * TODO: TEMPORARY, replace with the backend migration preview query once it ships.
 * Replicates the backend getMigrationPreview branch by branch: zero balance gets a zero
 * preview, a balance at or below the de-minimis threshold (100 sats) has its fee covered
 * by Blink and transfers whole, and anything above transfers the drain amount while the
 * fee is whatever the balance does not cover (the reserve plus at most one residual sat
 * that cannot fit, which the backend also folds into feeSats).
 */
export const getMigrationPreviewMock = (balanceSats: number): AccountMigrationPreview => {
  if (balanceSats <= 0) {
    return { balanceSats: 0, feeSats: 0, feeCoveredByBlink: false, receiveSats: 0 }
  }

  if (balanceSats <= DE_MINIMIS_THRESHOLD_SATS) {
    return {
      balanceSats,
      feeSats: MINIMUM_FEE_SATS,
      feeCoveredByBlink: true,
      receiveSats: balanceSats,
    }
  }

  const receiveSats = drainAmountForBalance(balanceSats)
  return {
    balanceSats,
    feeSats: balanceSats - receiveSats,
    feeCoveredByBlink: false,
    receiveSats,
  }
}
