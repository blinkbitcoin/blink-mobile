import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { toBtcMoneyAmount } from "@app/types/amounts"
import {
  DepositErrorReason,
  DepositStatus,
  PaymentResultStatus,
  type ClaimDepositAdapter,
  type ListPendingDepositsAdapter,
  type PaymentAdapterResult,
  type PendingDeposit,
} from "@app/types/payment"

import { claimDeposit, listDeposits, refundDeposit, type MappedDeposit } from "../bridge"
import { classifySdkError } from "../sdk-error"

const failed = (message: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [{ message }],
})

/**
 * Whether the deposit is still waiting to be claimed.
 *
 * A throw from `claimDeposit` is not proof that the claim failed: the SDK also raises from
 * the step after the funds have already settled, which is what told a reader
 * "Claim Failed: sdkError.SparkError" over money that had arrived. The unclaimed list is
 * the record that settles it, so it is read back before anyone is told anything.
 *
 * A listing that itself fails leaves the outcome unknown, and unknown counts as still
 * unclaimed: announcing a deposit that may never have landed is the worse of the two
 * mistakes, and the reader can retry a claim that already succeeded for free.
 */
const isStillUnclaimed = async (
  sdk: BreezSdkInterface,
  { txid, vout }: { txid: string; vout: number },
): Promise<boolean> => {
  try {
    const deposits = await listDeposits(sdk)
    return deposits.some((deposit) => deposit.txid === txid && deposit.vout === vout)
  } catch {
    return true
  }
}

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

export const parseDepositId = (
  depositId: string,
): { txid: string; vout: number } | null => {
  const lastColon = depositId.lastIndexOf(":")
  if (lastColon <= 0) return null
  const txid = depositId.substring(0, lastColon)
  const voutStr = depositId.substring(lastColon + 1)
  if (!txid || !/^\d+$/.test(voutStr)) return null
  const vout = Number(voutStr)
  /** Negatives never reach here: the digits-only test above already refused them. */
  if (!Number.isSafeInteger(vout)) return null
  return { txid, vout }
}

export const createListPendingDeposits = (
  sdk: BreezSdkInterface,
): ListPendingDepositsAdapter => {
  return async () => {
    try {
      const deposits = await listDeposits(sdk)
      return { deposits: deposits.map(mapToPendingDeposit) }
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
      await claimDeposit({ sdk, ...parsed, maxFeeSats })
      return { status: PaymentResultStatus.Success }
    } catch (err) {
      if (!(await isStillUnclaimed(sdk, parsed))) {
        return { status: PaymentResultStatus.Success }
      }
      /** A classified code, so the screen shows the reader a sentence rather than the
       *  SDK's own wording. The SDK's log listener records the raw error already. */
      return failed(classifySdkError(err))
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
