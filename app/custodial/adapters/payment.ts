import {
  HomeAuthedDocument,
  IntraLedgerPaymentSendMutationFn,
  IntraLedgerUsdPaymentSendMutationFn,
  PaymentSendResult,
} from "@app/graphql/generated"
import { ZeroUsdMoneyAmount } from "@app/types/amounts"
import {
  ConvertDirection,
  failedPayment,
  PaymentResultStatus,
  type ClaimDepositAdapter,
  type ConvertAdapter,
  type ConvertParams,
  type ConvertQuote,
  type ListPendingDepositsAdapter,
  type PaymentAdapterResult,
} from "@app/types/payment"
import { type WalletId } from "@app/types/wallet"

export class UnsupportedOperationError extends Error {
  constructor(operation: string) {
    super(`${operation} is not supported for custodial accounts`)
    this.name = "UnsupportedOperationError"
  }
}

const CONVERSION_FAILED_MESSAGE = "Conversion failed"

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

export type CustodialConvertDeps = {
  intraLedgerPaymentSend: IntraLedgerPaymentSendMutationFn
  intraLedgerUsdPaymentSend: IntraLedgerUsdPaymentSendMutationFn
  btcWalletId: WalletId
  usdWalletId: WalletId
}

type IntraLedgerOutcome = {
  status?: PaymentSendResult | null
  errors: ReadonlyArray<{ message: string }>
}

const resolveSourceAndTarget = (deps: CustodialConvertDeps, params: ConvertParams) => {
  const isBtcToUsd = params.direction === ConvertDirection.BtcToUsd
  return {
    sourceWalletId: isBtcToUsd ? deps.btcWalletId : deps.usdWalletId,
    recipientWalletId: isBtcToUsd ? deps.usdWalletId : deps.btcWalletId,
  }
}

const toAdapterResult = (
  outcome: IntraLedgerOutcome | undefined,
  apolloErrorMessage: string | undefined,
): PaymentAdapterResult => {
  if (outcome?.status === PaymentSendResult.Success) {
    return { status: PaymentResultStatus.Success }
  }
  return failedPayment(
    apolloErrorMessage ?? outcome?.errors[0]?.message ?? CONVERSION_FAILED_MESSAGE,
  )
}

const executeBtcToUsd = async (
  deps: CustodialConvertDeps,
  params: ConvertParams,
): Promise<PaymentAdapterResult> => {
  const { sourceWalletId, recipientWalletId } = resolveSourceAndTarget(deps, params)
  const { data, errors } = await deps.intraLedgerPaymentSend({
    variables: {
      input: {
        walletId: sourceWalletId,
        recipientWalletId,
        amount: params.fromAmount.amount,
      },
    },
    refetchQueries: [HomeAuthedDocument],
  })
  return toAdapterResult(data?.intraLedgerPaymentSend, errors?.[0]?.message)
}

const executeUsdToBtc = async (
  deps: CustodialConvertDeps,
  params: ConvertParams,
): Promise<PaymentAdapterResult> => {
  const { sourceWalletId, recipientWalletId } = resolveSourceAndTarget(deps, params)
  const { data, errors } = await deps.intraLedgerUsdPaymentSend({
    variables: {
      input: {
        walletId: sourceWalletId,
        recipientWalletId,
        amount: params.fromAmount.amount,
      },
    },
    refetchQueries: [HomeAuthedDocument],
  })
  return toAdapterResult(data?.intraLedgerUsdPaymentSend, errors?.[0]?.message)
}

export const createCustodialConvert = (deps: CustodialConvertDeps): ConvertAdapter => ({
  getQuote: async (params): Promise<ConvertQuote> => ({
    feeAmount: ZeroUsdMoneyAmount,
    showFeeRow: false,
    execute: () =>
      params.direction === ConvertDirection.BtcToUsd
        ? executeBtcToUsd(deps, params)
        : executeUsdToBtc(deps, params),
  }),
})
