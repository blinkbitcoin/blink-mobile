import {
  ClaimDepositRequest,
  DepositClaimError_Tags as ClaimErrorTag,
  Fee,
  ListUnclaimedDepositsRequest,
  MaxFee,
  RefundDepositRequest,
  type BreezSdkInterface,
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

  const inner = "inner" in deposit.claimError ? deposit.claimError.inner : null
  const message =
    inner && typeof inner === "object" && "message" in inner
      ? String((inner as Record<string, unknown>).message)
      : undefined

  if (message && message.toLowerCase().includes("dust limit")) {
    return { reason: "below_dust", message }
  }

  return { reason: "generic", message }
}

const mapDeposit = (deposit: DepositInfo): MappedDeposit => ({
  txid: deposit.txid,
  vout: deposit.vout,
  amountSats: toNumber(deposit.amountSats),
  isMature: deposit.isMature,
  claimError: mapClaimError(deposit),
  hasRefund: Boolean(deposit.refundTxId),
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

export const claimDeposit = async ({
  sdk,
  txid,
  vout,
  maxFeeSats,
}: ClaimParams): Promise<void> => {
  const maxFee = maxFeeSats ? new MaxFee.Fixed({ amount: BigInt(maxFeeSats) }) : undefined

  await sdk.claimDeposit(ClaimDepositRequest.create({ txid, vout, maxFee }))
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
