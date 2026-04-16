import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { toBtcMoneyAmount } from "@app/types/amounts"
import {
  DepositErrorReason,
  DepositStatus,
  FeeQuoteType,
  PaymentResultStatus,
  type ClaimDepositAdapter,
  type ListPendingDepositsAdapter,
  type PaymentAdapterResult,
  type PendingDeposit,
} from "@app/types/payment.types"

import { claimDeposit, listDeposits, refundDeposit, type MappedDeposit } from "../bridge"

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

const parseDepositId = (depositId: string): { txid: string; vout: number } => {
  const lastColon = depositId.lastIndexOf(":")
  return {
    txid: depositId.substring(0, lastColon),
    vout: Number(depositId.substring(lastColon + 1)),
  }
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
  getClaimFee: async ({ depositId }) => {
    try {
      const { txid, vout } = parseDepositId(depositId)
      const deposits = await listDeposits(sdk)
      const deposit = deposits.find((d) => d.txid === txid && d.vout === vout)
      if (!deposit) return null

      return {
        paymentType: FeeQuoteType.Claim,
        feeAmount: toBtcMoneyAmount(0),
      }
    } catch {
      return null
    }
  },

  claimDeposit: async ({ depositId, maxFeeSats }) => {
    try {
      const { txid, vout } = parseDepositId(depositId)
      await claimDeposit({ sdk, txid, vout, maxFeeSats })
      return { status: PaymentResultStatus.Success }
    } catch (err) {
      return failed(err instanceof Error ? err.message : `Claim failed: ${err}`)
    }
  },

  refundDeposit: async ({ depositId, destinationAddress, feeRateSatPerVb }) => {
    try {
      const { txid, vout } = parseDepositId(depositId)
      await refundDeposit({ sdk, txid, vout, destinationAddress, feeRateSatPerVb })
      return { status: PaymentResultStatus.Success }
    } catch (err) {
      return failed(err instanceof Error ? err.message : `Refund failed: ${err}`)
    }
  },
})
