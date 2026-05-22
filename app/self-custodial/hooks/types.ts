import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import {
  InvoiceType,
  PaymentRequestStateType,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

type UriParams = { uppercase?: boolean; prefix?: boolean }

export type InvoiceData = {
  invoiceType: InvoiceType
  paymentRequest?: string
  address?: string
  username?: string
  getFullUriFn: (params: UriParams) => string
  getCopyableInvoiceFn: () => string
}

type PaymentRequestInfo = {
  data?: InvoiceData
}

type ReceivingWalletDescriptor = {
  id: string
  currency: WalletCurrency
}

type ReceiveFeesInformation = {
  deposit: {
    minBankFee: string
    minBankFeeThreshold: string
    ratio: string
  }
}

type PaymentRequestSnapshot = {
  state?: PaymentRequestStateType
  info?: PaymentRequestInfo
}

export type SelfCustodialPaymentRequestState = {
  type: InvoiceType
  state?: PaymentRequestStateType
  setType: (type: InvoiceType) => void
  setMemo: () => void
  setAmount: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  switchReceivingWallet: (type: InvoiceType, currency: WalletCurrency) => void
  setExpirationTime: (time: number) => void
  regenerateInvoice: () => void
  expiresInSeconds: number | null
  expirationTime?: number
  canSetExpirationTime: boolean
  memo?: string
  memoChangeText: string | null
  setMemoChangeText: (text: string | null) => void
  convertMoneyAmount: NonNullable<
    ReturnType<typeof usePriceConversion>["convertMoneyAmount"]
  >
  settlementAmount?: MoneyAmount<WalletCurrency>
  unitOfAccountAmount?: MoneyAmount<WalletOrDisplayCurrency>
  receivingWalletDescriptor: ReceivingWalletDescriptor
  canSetAmount: boolean
  canSetMemo: boolean
  canUsePaycode: boolean
  btcWalletId?: string
  usdWalletId?: string
  lnAddressHostname: string
  feesInformation: ReceiveFeesInformation | undefined
  info?: PaymentRequestInfo
  paymentRequest: PaymentRequestSnapshot | null
  isAssetToggleDisabled?: boolean
  shouldShowAutoConvertMinWarning?: boolean
  autoConvertMinSats?: number
}
