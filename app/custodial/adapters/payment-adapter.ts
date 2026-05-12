import { PaymentSendResult } from "@app/graphql/generated"
import { toBtcMoneyAmount } from "@app/types/amounts"
import {
  FeeQuoteType,
  PaymentResultStatus,
  type ClaimDepositAdapter,
  type ConvertAdapter,
  type GetFeeAdapter,
  type ListPendingDepositsAdapter,
  type PaymentAdapterResult,
  type PaymentError,
  type ReceiveLightningAdapter,
  type ReceiveOnchainAdapter,
  type SendPaymentAdapter,
} from "@app/types/payment"

export class UnsupportedOperationError extends Error {
  constructor(operation: string) {
    super(`${operation} is not supported for custodial accounts`)
    this.name = "UnsupportedOperationError"
  }
}

type SendMutation = (args: {
  destination: string
  amount?: number
  memo?: string
}) => Promise<{
  status: PaymentSendResult
  errors: Array<{ message: string }>
}>

type FeeMutation = (args: {
  destination: string
  amount?: number
}) => Promise<{ amount: number } | null>

type CreateInvoiceMutation = (args: {
  amount?: number
  memo?: string
}) => Promise<{ invoice: string } | null>

type GetAddressMutation = () => Promise<{ address: string } | null>

const toPaymentError = (message: string): PaymentError => ({
  message,
})

const failed = (message: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [toPaymentError(message)],
})

const receiveError = (message: string) => ({
  errors: [toPaymentError(message)],
})

const mapSendStatus = (status: PaymentSendResult): PaymentResultStatus => {
  if (status === PaymentSendResult.Success) return PaymentResultStatus.Success
  if (status === PaymentSendResult.Pending) return PaymentResultStatus.Pending
  return PaymentResultStatus.Failed
}

export const createCustodialSendPayment = (
  mutation: SendMutation,
): SendPaymentAdapter => {
  return async (params) => {
    const result = await mutation({
      destination: params.destination,
      amount: params.amount?.amount,
      memo: params.memo,
    })
    return {
      status: mapSendStatus(result.status),
      errors: result.errors.map((e) => toPaymentError(e.message)),
    }
  }
}

export const createCustodialGetFee = (mutation: FeeMutation): GetFeeAdapter => {
  return async (params) => {
    const result = await mutation({
      destination: params.destination,
      amount: params.amount?.amount,
    })
    if (!result) return null
    return {
      paymentType: FeeQuoteType.Lightning,
      feeAmount: toBtcMoneyAmount(result.amount),
    }
  }
}

export const createCustodialReceiveLightning = (
  mutation: CreateInvoiceMutation,
): ReceiveLightningAdapter => {
  return async (params) => {
    const result = await mutation({
      amount: params.amount?.amount,
      memo: params.memo,
    })
    if (!result) return receiveError("Failed to create invoice")
    return { invoice: result.invoice }
  }
}

export const createCustodialReceiveOnchain = (
  mutation: GetAddressMutation,
): ReceiveOnchainAdapter => {
  return async () => {
    const result = await mutation()
    if (!result) return receiveError("Failed to get address")
    return { address: result.address }
  }
}

export const createCustodialListPendingDeposits: ListPendingDepositsAdapter =
  async () => ({
    deposits: [],
  })

export const createCustodialClaimDeposit: ClaimDepositAdapter = {
  getClaimFee: async () => {
    throw new UnsupportedOperationError("getClaimFee")
  },
  claimDeposit: async () => {
    throw new UnsupportedOperationError("claimDeposit")
  },
  refundDeposit: async () => {
    throw new UnsupportedOperationError("refundDeposit")
  },
}

export const createCustodialConvert: ConvertAdapter = async () =>
  failed("Conversion not yet supported for custodial accounts")
