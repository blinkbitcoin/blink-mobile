/**
 * Domain Nomenclature:
 * -------------------
 * PaymentRequestCreationData - Clientside request data to create the actual request
 * PaymentRequest - Generated quotation which contains the finalized invoice data
 * Invoice - (not specific to LN) The quoted invoice that contains invoice type specific data
 */
import { GraphQLError, GraphQLFormattedError } from "graphql"

import {
  GraphQlApplicationError,
  LnInvoice,
  LnNoAmountInvoice,
  WalletCurrency,
  LnNoAmountInvoiceCreateMutationHookResult,
  LnInvoiceCreateMutationHookResult,
  LnUsdInvoiceCreateMutationHookResult,
  OnChainAddressCurrentMutationHookResult,
  Network,
} from "@app/graphql/generated"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import {
  BtcMoneyAmount,
  MoneyAmount,
  WalletAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { BtcWalletDescriptor, WalletDescriptor } from "@app/types/wallets"

// ------------------------ COMMONS ------------------------

/* Invoice */
export const Invoice = {
  Lightning: "Lightning",
  OnChain: "OnChain",
  PayCode: "PayCode",
} as const
export type InvoiceType = (typeof Invoice)[keyof typeof Invoice]

/* Invoice Data */
export type InvoiceData = (
  | LightningInvoiceData
  | OnChainInvoiceData
  | PayCodeInvoiceData
) & {
  getFullUriFn: GetFullUriFn
  getCopyableInvoiceFn: GetCopyableInvoiceFn
}

export type LnInvoiceNoSecret = Omit<LnInvoice, "paymentSecret">
type LnInvoiceNoSecretNoAmount = Omit<LnNoAmountInvoice, "paymentSecret">

type LnInvoiceWithOrWithoutAmountNoSecret = LnInvoiceNoSecret | LnInvoiceNoSecretNoAmount

export type LightningInvoiceData = LnInvoiceWithOrWithoutAmountNoSecret & {
  invoiceType: typeof Invoice.Lightning
  expiresAt?: Date
  memo?: string
}
export type OnChainInvoiceData = {
  invoiceType: typeof Invoice.OnChain
  address?: string // TODO: this should not be undefinable
  amount?: BtcMoneyAmount | undefined
  memo?: string
}
export type PayCodeInvoiceData = {
  invoiceType: typeof Invoice.PayCode
  username: string
}

// Misc
export type GetCopyableInvoiceFn = () => string
export type GetFullUriFn = (params: { uppercase?: boolean; prefix?: boolean }) => string
export type GetFullUriInput = {
  input: string
  amount?: number
  memo?: string
  uppercase?: boolean
  prefix?: boolean
  type?: InvoiceType
}
export type ConvertMoneyAmountFn = ConvertMoneyAmount

// ------------------------ REQUEST ------------------------

/* Stores clientside details and instructions to be sent to the server and generate a PaymentQuotation */
export type PaymentRequestCreationData<T extends WalletCurrency> =
  BasePaymentRequestCreationData<T>

type BasePaymentRequestCreationData<T extends WalletCurrency> = {
  // Invoice Type
  type: InvoiceType
  setType: (type: InvoiceType) => PaymentRequestCreationData<T>

  // Default Wallet Descriptor
  defaultWalletDescriptor: WalletDescriptor<T>
  setDefaultWalletDescriptor: (
    defaultWalletDescriptor: WalletDescriptor<T>,
  ) => PaymentRequestCreationData<T>

  // Bitcoin Wallet Descriptor
  bitcoinWalletDescriptor: BtcWalletDescriptor
  setBitcoinWalletDescriptor: (
    bitcoinWalletDescriptor: BtcWalletDescriptor,
  ) => PaymentRequestCreationData<T>

  // Receive in which wallet information
  receivingWalletDescriptor: WalletDescriptor<T>
  canSetReceivingWalletDescriptor: boolean
  setReceivingWalletDescriptor?: (
    receivingWalletDescriptor: WalletDescriptor<T>,
  ) => PaymentRequestCreationData<T>

  // Memo
  canSetMemo: boolean
  memo?: string
  setMemo?: (memo: string) => PaymentRequestCreationData<T>

  // Amount
  canSetAmount: boolean
  setAmount?: (
    unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>,
  ) => PaymentRequestCreationData<T>
  unitOfAccountAmount?: MoneyAmount<WalletOrDisplayCurrency>
  settlementAmount?: WalletAmount<T>

  // For money conversion in case amount is given
  convertMoneyAmount: ConvertMoneyAmount
  setConvertMoneyAmount: (
    convertMoneyAmount: ConvertMoneyAmount,
  ) => PaymentRequestCreationData<T>

  // Can use paycode (if username is set)
  canUsePaycode: boolean
  username?: string
  setUsername: (username: string) => PaymentRequestCreationData<T>
  posUrl: string
  lnAddressHostname: string

  network: Network
}

export type BaseCreatePaymentRequestCreationDataParams<T extends WalletCurrency> = {
  type: InvoiceType
  defaultWalletDescriptor: WalletDescriptor<T>
  bitcoinWalletDescriptor: BtcWalletDescriptor
  convertMoneyAmount: ConvertMoneyAmount
  username?: string
  posUrl: string
  lnAddressHostname: string
  receivingWalletDescriptor?: WalletDescriptor<T>
  memo?: string
  unitOfAccountAmount?: MoneyAmount<WalletOrDisplayCurrency>
  network: Network
}

// ------------------------ QUOTATION ------------------------

export const PaymentRequestState = {
  Idle: "Idle",
  Loading: "Loading",
  Created: "Created",
  Error: "Error",
  Paid: "Paid",
  Expired: "Expired",
} as const
export type PaymentRequestStateType =
  (typeof PaymentRequestState)[keyof typeof PaymentRequestState]

export type GeneratePaymentRequestMutations = {
  lnNoAmountInvoiceCreate: LnNoAmountInvoiceCreateMutationHookResult["0"]
  lnInvoiceCreate: LnInvoiceCreateMutationHookResult["0"]
  lnUsdInvoiceCreate: LnUsdInvoiceCreateMutationHookResult["0"]
  onChainAddressCurrent: OnChainAddressCurrentMutationHookResult["0"]
}

/* Has immutable payment quotation from the server and handles payment state for itself (via hook) */
export type PaymentRequest = {
  state: PaymentRequestStateType
  setState: (state: PaymentRequestStateType) => PaymentRequest
  generateRequest: () => Promise<PaymentRequest>
  info?: PaymentRequestInformation
  creationData: PaymentRequestCreationData<WalletCurrency>
}

export type PaymentRequestInformation = {
  data: InvoiceData | undefined
  applicationErrors: readonly GraphQlApplicationError[] | undefined
  gqlErrors: readonly GraphQLError[] | readonly GraphQLFormattedError[] | undefined
}

export type CreatePaymentRequestParams = {
  creationData: PaymentRequestCreationData<WalletCurrency>
  mutations: GeneratePaymentRequestMutations
  state?: PaymentRequestStateType
  info?: PaymentRequestInformation
}
