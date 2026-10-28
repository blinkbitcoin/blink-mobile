import {
  ClaimDeferredReason_Tags as DeferredReasonTag,
  ClaimDepositOutcome_Tags as ClaimOutcomeTag,
  ClaimDepositRequest,
  DepositClaimError_Tags as ClaimErrorTag,
  Fee,
  ListUnclaimedDepositsRequest,
  MaxFee,
  MaxOnchainFee,
  InstantClaimStatus_Tags as InstantClaimTag,
  RefundDepositRequest,
  type BreezSdkInterface,
  type ClaimDepositOutcome,
  type DepositInfo,
} from "@breeztech/breez-sdk-spark-react-native"

import { toNumber } from "@app/utils/helper"

export type ClaimErrorInfo = {
  reason: "fee_exceeded" | "missing_utxo" | "below_dust" | "generic"
  requiredFeeSats?: number
  message?: string
}

export type MappedDeposit = {
  txid: string
  vout: number
  amountSats: number
  isMature: boolean
  claimError: ClaimErrorInfo | null
  hasRefund: boolean
  /** Claimed ahead of maturity (0.26). The SDK keeps the row until the UTXO leaves its
   *  chain feed, but the funds are already in the balance. */
  claimedEarly: boolean
}

const mapClaimError = (deposit: DepositInfo): ClaimErrorInfo | null => {
  if (!deposit.claimError) return null

  if (deposit.claimError.tag === ClaimErrorTag.MaxDepositClaimFeeExceeded) {
    return {
      reason: "fee_exceeded",
      requiredFeeSats: toNumber(deposit.claimError.inner.requiredFeeSats),
    }
  }

  if (deposit.claimError.tag === ClaimErrorTag.MissingUtxo) {
    return { reason: "missing_utxo" }
  }

  /** Its claim fee would leave it at or under the dust limit (0.27). */
  if (deposit.claimError.tag === ClaimErrorTag.DepositTooSmall) {
    return { reason: "below_dust" }
  }

  const inner = "inner" in deposit.claimError ? deposit.claimError.inner : null
  const message =
    inner && typeof inner === "object" && "message" in inner
      ? String((inner as Record<string, unknown>).message)
      : undefined

  return { reason: "generic", message }
}

const mapDeposit = (deposit: DepositInfo): MappedDeposit => ({
  txid: deposit.txid,
  vout: deposit.vout,
  amountSats: toNumber(deposit.amountSats),
  isMature: deposit.isMature,
  claimError: mapClaimError(deposit),
  hasRefund: Boolean(deposit.refundTxId),
  claimedEarly:
    deposit.instantClaimStatus?.tag === InstantClaimTag.Submitted ||
    deposit.instantClaimStatus?.tag === InstantClaimTag.Claimed,
})

export const listDeposits = async (sdk: BreezSdkInterface): Promise<MappedDeposit[]> => {
  const response = await sdk.listUnclaimedDeposits(
    ListUnclaimedDepositsRequest.create({}),
  )
  return response.deposits.map(mapDeposit)
}

type ClaimParams = {
  sdk: BreezSdkInterface
  txid: string
  vout: number
  maxFeeSats?: number
}

export type ClaimOutcome =
  | { status: "settled" }
  | { status: "submitted" }
  | { status: "deferred"; reason: "fee_exceeded"; requiredFeeSats: number }
  | { status: "deferred"; reason: "awaiting_confirmations" }
  | { status: "deferred"; reason: "provider_declined"; message: string }

const mapClaimOutcome = (outcome: ClaimDepositOutcome): ClaimOutcome => {
  if (outcome.tag === ClaimOutcomeTag.Settled) return { status: "settled" }
  if (outcome.tag === ClaimOutcomeTag.Submitted) return { status: "submitted" }

  const { reason } = outcome.inner
  if (reason.tag === DeferredReasonTag.MaxFeeExceeded) {
    return {
      status: "deferred",
      reason: "fee_exceeded",
      requiredFeeSats: toNumber(reason.inner.requiredFeeSats),
    }
  }
  if (reason.tag === DeferredReasonTag.NoEarlyClaimAvailable) {
    return { status: "deferred", reason: "awaiting_confirmations" }
  }
  return {
    status: "deferred",
    reason: "provider_declined",
    message: reason.inner.message,
  }
}

/**
 * A max fee passed here is recorded on the deposit, so the SDK's later automatic
 * attempts on it are held to the same cap. Without one, the configured cap applies and
 * any cap recorded earlier is cleared.
 */
export const claimDeposit = async ({
  sdk,
  txid,
  vout,
  maxFeeSats,
}: ClaimParams): Promise<ClaimOutcome> => {
  /** `maxFeeSats` is a quoted claim fee, which already includes any proportional
   *  provider fee, so the ceiling takes no proportional part of its own. */
  const maxFee = maxFeeSats
    ? MaxFee.create({ onchain: new MaxOnchainFee.Fixed({ amount: BigInt(maxFeeSats) }) })
    : undefined

  const { outcome } = await sdk.claimDeposit(
    ClaimDepositRequest.create({ txid, vout, maxFee }),
  )
  return mapClaimOutcome(outcome)
}

export type NetworkFeeRates = {
  fastest: number
  halfHour: number
  hour: number
  economy: number
  minimum: number
}

export const getRecommendedFees = async (
  sdk: BreezSdkInterface,
): Promise<NetworkFeeRates> => {
  const fees = await sdk.recommendedFees()
  return {
    fastest: toNumber(fees.fastestFee),
    halfHour: toNumber(fees.halfHourFee),
    hour: toNumber(fees.hourFee),
    economy: toNumber(fees.economyFee),
    minimum: toNumber(fees.minimumFee),
  }
}

type RefundParams = {
  sdk: BreezSdkInterface
  txid: string
  vout: number
  destinationAddress: string
  feeRateSatPerVb: number
}

export const refundDeposit = async ({
  sdk,
  txid,
  vout,
  destinationAddress,
  feeRateSatPerVb,
}: RefundParams): Promise<void> => {
  await sdk.refundDeposit(
    RefundDepositRequest.create({
      txid,
      vout,
      destinationAddress,
      fee: new Fee.Rate({ satPerVbyte: BigInt(feeRateSatPerVb) }),
    }),
  )
}
