import {
  SdkError,
  SdkError_Tags as SdkErrorTags,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { toBtcMoneyAmount } from "@app/types/amounts"
import {
  DepositClaimDeferral,
  DepositErrorReason,
  DepositStatus,
  PaymentResultStatus,
  type ClaimDepositAdapter,
  type ClaimDepositResult,
  type ListPendingDepositsAdapter,
  type PaymentAdapterResult,
  type PendingDeposit,
} from "@app/types/payment"

import {
  claimDeposit,
  listDeposits,
  refundDeposit,
  type ClaimOutcome,
  type MappedDeposit,
} from "../bridge"

const failed = (message: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [{ message }],
})

const resolveStatus = ({
  isMature,
  claimError,
  hasRefund,
}: MappedDeposit): DepositStatus => {
  if (hasRefund) return DepositStatus.Refunded
  if (!isMature) return DepositStatus.Immature
  if (claimError?.reason === "fee_exceeded") return DepositStatus.FeeExceeded
  if (claimError) return DepositStatus.Error
  return DepositStatus.Claimable
}

const resolveErrorReason = (
  claimError: MappedDeposit["claimError"],
): DepositErrorReason | null => {
  if (!claimError) return null
  if (claimError.reason === "fee_exceeded") return DepositErrorReason.FeeExceeded
  if (claimError.reason === "missing_utxo") return DepositErrorReason.MissingUtxo
  if (claimError.reason === "below_dust") return DepositErrorReason.BelowDust
  return DepositErrorReason.Generic
}

const mapToPendingDeposit = (deposit: MappedDeposit): PendingDeposit => ({
  id: `${deposit.txid}:${deposit.vout}`,
  txid: deposit.txid,
  vout: deposit.vout,
  amount: toBtcMoneyAmount(deposit.amountSats),
  status: resolveStatus(deposit),
  errorReason: resolveErrorReason(deposit.claimError),
  requiredFeeSats: deposit.claimError?.requiredFeeSats,
  errorMessage: deposit.claimError?.message,
})

const toClaimResult = (outcome: ClaimOutcome): ClaimDepositResult => {
  if (outcome.status !== "deferred") return { status: PaymentResultStatus.Success }
  if (outcome.reason === "fee_exceeded") {
    return {
      ...failed(`Claim needs ${outcome.requiredFeeSats} sats in fees`),
      deferral: DepositClaimDeferral.FeeExceeded,
      requiredFeeSats: outcome.requiredFeeSats,
    }
  }
  if (outcome.reason === "awaiting_confirmations") {
    return {
      ...failed("Deposit cannot be claimed before it confirms"),
      deferral: DepositClaimDeferral.AwaitingConfirmations,
    }
  }
  return { ...failed(outcome.message), deferral: DepositClaimDeferral.ProviderDeclined }
}

const isClaimInProgress = (err: unknown): boolean =>
  SdkError.instanceOf(err) && err.tag === SdkErrorTags.DepositClaimInProgress

const isDepositTooSmall = (err: unknown): boolean =>
  SdkError.instanceOf(err) && err.tag === SdkErrorTags.DepositTooSmall

export const parseDepositId = (
  depositId: string,
): { txid: string; vout: number } | null => {
  const lastColon = depositId.lastIndexOf(":")
  if (lastColon <= 0) return null
  const txid = depositId.substring(0, lastColon)
  const voutStr = depositId.substring(lastColon + 1)
  if (!txid || !/^\d+$/.test(voutStr)) return null
  const vout = Number(voutStr)
  if (!Number.isSafeInteger(vout) || vout < 0) return null
  return { txid, vout }
}

export const createListPendingDeposits = (
  sdk: BreezSdkInterface,
): ListPendingDepositsAdapter => {
  return async () => {
    try {
      const deposits = await listDeposits(sdk)
      return {
        deposits: deposits
          .filter(({ claimedEarly }) => !claimedEarly)
          .map(mapToPendingDeposit),
      }
    } catch (err) {
      return {
        deposits: [],
        errors: [
          {
            message: err instanceof Error ? err.message : `List deposits failed: ${err}`,
          },
        ],
      }
    }
  }
}

export const createClaimDeposit = (sdk: BreezSdkInterface): ClaimDepositAdapter => ({
  // null signals "fee unknown" to the UI; SDK has no standalone claim-fee quote.
  getClaimFee: async ({ depositId }) => {
    if (!parseDepositId(depositId)) return null
    return null
  },

  claimDeposit: async ({ depositId, maxFeeSats }) => {
    const parsed = parseDepositId(depositId)
    if (!parsed) return failed(`Invalid depositId: ${depositId}`)
    try {
      return toClaimResult(await claimDeposit({ sdk, ...parsed, maxFeeSats }))
    } catch (err) {
      /** The SDK's sync loop is already claiming this deposit; that claim settles it. */
      if (isClaimInProgress(err)) return { status: PaymentResultStatus.Pending }
      if (isDepositTooSmall(err)) {
        return {
          ...failed("Deposit is too small to claim after fees"),
          errorReason: DepositErrorReason.BelowDust,
        }
      }
      return failed(err instanceof Error ? err.message : `Claim failed: ${err}`)
    }
  },

  refundDeposit: async ({ depositId, destinationAddress, feeRateSatPerVb }) => {
    const parsed = parseDepositId(depositId)
    if (!parsed) return failed(`Invalid depositId: ${depositId}`)
    try {
      await refundDeposit({ sdk, ...parsed, destinationAddress, feeRateSatPerVb })
      return { status: PaymentResultStatus.Success }
    } catch (err) {
      return failed(err instanceof Error ? err.message : `Refund failed: ${err}`)
    }
  },
})
