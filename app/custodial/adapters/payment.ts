import {
  HomeAuthedDocument,
  IntraLedgerPaymentSendMutationFn,
  IntraLedgerUsdPaymentSendMutationFn,
  LnInvoiceCreateMutationFn,
  LnNoAmountInvoiceCreateMutationFn,
  LnUsdInvoiceCreateMutationFn,
  OnChainAddressCurrentMutationFn,
  PaymentSendResult,
  WalletCurrency,
} from "@app/graphql/generated"
import { ZeroUsdMoneyAmount } from "@app/types/amounts"
import {
  ConvertDirection,
  extractApolloErrorMessage,
  failedPayment,
  failedReceive,
  PaymentResultStatus,
  type ClaimDepositAdapter,
  type ConvertAdapter,
  type ConvertParams,
  type ConvertQuote,
  type ListPendingDepositsAdapter,
  type PaymentAdapterResult,
  type ReceiveLightningAdapter,
  type ReceiveOnchainAdapter,
} from "@app/types/payment"
import { type WalletId } from "@app/types/wallet"

export class UnsupportedOperationError extends Error {
  constructor(operation: string) {
    super(`${operation} is not supported for custodial accounts`)
    this.name = "UnsupportedOperationError"
  }
}

const CONVERSION_FAILED_MESSAGE = "Conversion failed"
const LIGHTNING_INVOICE_FAILED_MESSAGE = "Lightning invoice creation failed"
const ONCHAIN_ADDRESS_FAILED_MESSAGE = "Onchain address creation failed"

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
  apolloErrors: readonly { message: string }[] | undefined,
): PaymentAdapterResult => {
  if (outcome?.status === PaymentSendResult.Success) {
    return { status: PaymentResultStatus.Success }
  }
  return failedPayment(
    extractApolloErrorMessage(apolloErrors, outcome?.errors, CONVERSION_FAILED_MESSAGE),
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
  return toAdapterResult(data?.intraLedgerPaymentSend, errors)
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
  return toAdapterResult(data?.intraLedgerUsdPaymentSend, errors)
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

type CustodialReceiveDeps = {
  lnInvoiceCreate: LnInvoiceCreateMutationFn
  lnNoAmountInvoiceCreate: LnNoAmountInvoiceCreateMutationFn
  lnUsdInvoiceCreate: LnUsdInvoiceCreateMutationFn
  onChainAddressCurrent: OnChainAddressCurrentMutationFn
  btcWalletId: WalletId
  usdWalletId: WalletId
}

type LnInvoicePayload = {
  paymentRequest: string
  paymentHash?: string | null
  externalId?: string | null
  createdAt?: string | number | null
  paymentStatus?: string | null
  satoshis?: number | null
}

const toReceiveInvoice = (invoice: LnInvoicePayload) => ({
  paymentRequest: invoice.paymentRequest,
  paymentHash: invoice.paymentHash ?? undefined,
  externalId: invoice.externalId ?? undefined,
  createdAt:
    invoice.createdAt === null || invoice.createdAt === undefined
      ? undefined
      : Number(invoice.createdAt),
  paymentStatus: invoice.paymentStatus ?? undefined,
  satoshis: invoice.satoshis ?? undefined,
})

type LightningInvoiceOutcome = {
  invoice?: LnInvoicePayload | null
  errors: ReadonlyArray<{ message: string }>
}

const toReceiveLightningResult = (
  outcome: LightningInvoiceOutcome | undefined,
  apolloErrors: readonly { message: string }[] | undefined,
) => {
  if (!outcome?.invoice || apolloErrors?.length || outcome?.errors?.length) {
    return failedReceive(
      extractApolloErrorMessage(
        apolloErrors,
        outcome?.errors,
        LIGHTNING_INVOICE_FAILED_MESSAGE,
      ),
    )
  }
  return { invoice: toReceiveInvoice(outcome.invoice) }
}

type LightningInvoiceArgs = {
  amount: number
  memo?: string
  expiresIn?: string
}

const createUsdInvoice = async (
  deps: CustodialReceiveDeps,
  args: LightningInvoiceArgs,
) => {
  const { data, errors } = await deps.lnUsdInvoiceCreate({
    variables: { input: { walletId: deps.usdWalletId, ...args } },
  })
  return toReceiveLightningResult(data?.lnUsdInvoiceCreate, errors)
}

const createBtcInvoiceWithAmount = async (
  deps: CustodialReceiveDeps,
  args: LightningInvoiceArgs,
) => {
  const { data, errors } = await deps.lnInvoiceCreate({
    variables: { input: { walletId: deps.btcWalletId, ...args } },
  })
  return toReceiveLightningResult(data?.lnInvoiceCreate, errors)
}

const createNoAmountInvoice = async (
  deps: CustodialReceiveDeps,
  walletId: WalletId,
  args: Omit<LightningInvoiceArgs, "amount">,
) => {
  const { data, errors } = await deps.lnNoAmountInvoiceCreate({
    variables: { input: { walletId, ...args } },
  })
  return toReceiveLightningResult(data?.lnNoAmountInvoiceCreate, errors)
}

export const createCustodialReceiveLightning = (
  deps: CustodialReceiveDeps,
): ReceiveLightningAdapter => {
  return async ({ walletCurrency, amount, memo, expirationTimeMinutes }) => {
    const hasAmount = amount !== undefined && amount.amount > 0
    const expiresIn = expirationTimeMinutes?.toString()

    if (hasAmount) {
      if (walletCurrency === WalletCurrency.Usd) {
        return createUsdInvoice(deps, { amount: amount.amount, memo, expiresIn })
      }
      return createBtcInvoiceWithAmount(deps, { amount: amount.amount, memo, expiresIn })
    }

    const walletId =
      walletCurrency === WalletCurrency.Usd ? deps.usdWalletId : deps.btcWalletId
    return createNoAmountInvoice(deps, walletId, { memo, expiresIn })
  }
}

export const createCustodialReceiveOnchain = (
  deps: CustodialReceiveDeps,
): ReceiveOnchainAdapter => {
  return async ({ walletCurrency }) => {
    const walletId =
      walletCurrency === WalletCurrency.Usd ? deps.usdWalletId : deps.btcWalletId
    const { data, errors } = await deps.onChainAddressCurrent({
      variables: { input: { walletId } },
    })
    const payload = data?.onChainAddressCurrent
    const address = payload?.address ?? undefined
    if (!address) {
      return failedReceive(
        extractApolloErrorMessage(
          errors,
          payload?.errors,
          ONCHAIN_ADDRESS_FAILED_MESSAGE,
        ),
      )
    }
    return { address }
  }
}
