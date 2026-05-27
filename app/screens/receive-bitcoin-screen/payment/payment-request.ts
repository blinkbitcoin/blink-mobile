import { bech32 } from "bech32"

import { WalletCurrency } from "@app/graphql/generated"
import { BtcMoneyAmount, MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { getLightningAddress } from "@app/utils/pay-links"

import { getPaymentRequestFullUri, prToDateString } from "./helpers"
import {
  CreatePaymentRequestParams,
  GeneratePaymentRequestAdapters,
  GetCopyableInvoiceFn,
  GetFullUriFn,
  Invoice,
  PaymentRequest,
  PaymentRequestCreationData,
  PaymentRequestInformation,
  PaymentRequestState,
  PaymentRequestStateType,
} from "./index.types"

const DEFAULT_MEMO = "Pay to Blink Wallet User"
const LNURL_BECH32_LIMIT = 1500
const LNURL_RENDER_DELAY_MS = 50

type PrCreationData = PaymentRequestCreationData<WalletCurrency>

const formatPayCodeAmountQuery = (
  amount: MoneyAmount<WalletOrDisplayCurrency> | undefined,
): string => {
  if (!amount || amount.amount === 0) return ""
  return `amount=${amount.amount}&currency=${amount.currencyCode}`
}

const buildOnchainInfo = async (
  request: PrCreationData,
  adapters: GeneratePaymentRequestAdapters,
): Promise<PaymentRequestInformation> => {
  if (
    request.settlementAmount &&
    request.settlementAmount.currency !== WalletCurrency.Btc
  ) {
    throw new Error("Onchain invoices only support BTC")
  }

  const result = await adapters.receiveOnchain({ walletCurrency: WalletCurrency.Btc })
  const { address } = result

  if (!address) return { data: undefined, errors: result.errors }

  const getFullUriFn: GetFullUriFn = ({ uppercase, prefix }) =>
    getPaymentRequestFullUri({
      type: Invoice.OnChain,
      input: address,
      amount: request.settlementAmount?.amount,
      memo: request.memo,
      uppercase,
      prefix,
    })
  const getCopyableInvoiceFn: GetCopyableInvoiceFn = () => address

  return {
    data: {
      invoiceType: Invoice.OnChain,
      getFullUriFn,
      getCopyableInvoiceFn,
      address,
      amount: request.settlementAmount as BtcMoneyAmount,
      memo: request.memo,
    },
    errors: result.errors,
  }
}

const buildLightningInfo = async (
  request: PrCreationData,
  adapters: GeneratePaymentRequestAdapters,
): Promise<PaymentRequestInformation> => {
  const { settlementAmount } = request
  const hasPositiveAmount = settlementAmount !== undefined && settlementAmount.amount > 0
  const lightningAmount = hasPositiveAmount
    ? (settlementAmount as MoneyAmount<WalletCurrency>)
    : undefined

  const result = await adapters.receiveLightning({
    walletCurrency: request.receivingWalletDescriptor.currency,
    amount: lightningAmount,
    memo: request.memo,
    expirationTimeMinutes: request.expirationTime,
  })

  if (!result.invoice) return { data: undefined, errors: result.errors }

  const { invoice } = result
  const dateString = prToDateString(invoice.paymentRequest, request.network)
  const expiresAt = dateString ? new Date(dateString) : undefined

  const getFullUriFn: GetFullUriFn = ({ uppercase, prefix }) =>
    getPaymentRequestFullUri({
      type: Invoice.Lightning,
      input: invoice.paymentRequest,
      amount: request.settlementAmount?.amount,
      memo: request.memo,
      uppercase,
      prefix,
    })
  const getCopyableInvoiceFn: GetCopyableInvoiceFn = () => getFullUriFn({})

  return {
    data: {
      invoiceType: Invoice.Lightning,
      paymentRequest: invoice.paymentRequest,
      paymentHash: invoice.paymentHash ?? "",
      externalId: invoice.externalId ?? "",
      paymentStatus: invoice.paymentStatus,
      createdAt: invoice.createdAt,
      satoshis: invoice.satoshis,
      expiresAt,
      getCopyableInvoiceFn,
      getFullUriFn,
    },
    errors: result.errors,
  }
}

const encodeLnurl = (posUrl: string, username: string, amountQuery: string): string =>
  bech32.encode(
    "lnurl",
    bech32.toWords(
      Buffer.from(
        `${posUrl}/.well-known/lnurlp/${username}${amountQuery ? `?${amountQuery}` : ""}`,
        "utf8",
      ),
    ),
    LNURL_BECH32_LIMIT,
  )

const buildPayCodeInfo = async (
  request: PrCreationData,
  username: string,
): Promise<PaymentRequestInformation> => {
  const amountQuery = formatPayCodeAmountQuery(request.unitOfAccountAmount)
  const lnurl = encodeLnurl(request.posUrl, username, amountQuery)

  /** Defer one frame so the loading state paints (bech32.encode takes ~10ms on slower phones). */
  await new Promise<void>((resolve) => {
    setTimeout(resolve, LNURL_RENDER_DELAY_MS)
  })

  const getFullUriFn: GetFullUriFn = ({ uppercase, prefix }) =>
    getPaymentRequestFullUri({
      type: Invoice.PayCode,
      input: lnurl.toUpperCase(),
      uppercase,
      prefix,
    })
  const getCopyableInvoiceFn: GetCopyableInvoiceFn = () =>
    getLightningAddress(request.lnAddressHostname, username)

  return {
    data: {
      invoiceType: Invoice.PayCode,
      username,
      getCopyableInvoiceFn,
      getFullUriFn,
    },
    errors: undefined,
  }
}

const buildInfoForType = (
  request: PrCreationData,
  adapters: GeneratePaymentRequestAdapters,
): Promise<PaymentRequestInformation> => {
  switch (request.type) {
    case Invoice.OnChain:
      return buildOnchainInfo(request, adapters)
    case Invoice.Lightning:
      return buildLightningInfo(request, adapters)
    case Invoice.PayCode:
      return buildPayCodeInfo(request, request.username as string)
    default:
      throw new Error("Unknown Payment Request Type Encountered - Please Report")
  }
}

export const createPaymentRequest = (
  params: CreatePaymentRequestParams,
): PaymentRequest => {
  let { state } = params
  const { info } = params
  if (!state) state = PaymentRequestState.Idle

  const setState = (state: PaymentRequestStateType) => {
    if (state === PaymentRequestState.Loading)
      return createPaymentRequest({ ...params, state, info: undefined })
    return createPaymentRequest({ ...params, state })
  }

  /** The hook should setState(Loading) before calling this. */
  const generateQuote: () => Promise<PaymentRequest> = async () => {
    const { creationData, adapters } = params
    const request = { ...creationData }
    if (!request.memo) request.memo = DEFAULT_MEMO

    if (request.type === Invoice.PayCode && !request.username) {
      return createPaymentRequest({
        ...params,
        state: PaymentRequestState.Created,
        info: undefined,
      })
    }

    const nextInfo = await buildInfoForType(request, adapters)
    const succeeded = !nextInfo.errors?.length && Boolean(nextInfo.data)
    const nextState = succeeded ? PaymentRequestState.Created : PaymentRequestState.Error

    return createPaymentRequest({ ...params, info: nextInfo, state: nextState })
  }

  return { ...params, state, info, generateRequest: generateQuote, setState }
}
