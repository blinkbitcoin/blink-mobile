import {
  PaymentResultStatus,
  type ClaimDepositAdapter,
  type ConvertAdapter,
  type ListPendingDepositsAdapter,
  type PaymentAdapterResult,
  type PaymentError,
} from "@app/types/payment"

export class UnsupportedOperationError extends Error {
  constructor(operation: string) {
    super(`${operation} is not supported for custodial accounts`)
    this.name = "UnsupportedOperationError"
  }
}

const toPaymentError = (message: string): PaymentError => ({
  message,
})

const failed = (message: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [toPaymentError(message)],
})

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
