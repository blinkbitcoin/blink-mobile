import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { InvoiceType } from "@app/screens/receive-bitcoin-screen/payment/index.types"
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

export type SelfCustodialPaymentRequestState = {
  type: InvoiceType
  state: string
  setType: (type: InvoiceType) => void
  setMemo: () => void
  setAmount: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  switchReceivingWallet: (type: InvoiceType, currency: WalletCurrency) => void
  setExpirationTime: (time: number) => void
  regenerateInvoice: () => void
  expiresInSeconds: number | undefined
  expirationTime: number
  canSetExpirationTime: boolean
  memo?: string
  memoChangeText: string | null
  setMemoChangeText: (text: string | null) => void
  convertMoneyAmount: ReturnType<typeof usePriceConversion>["convertMoneyAmount"]
  settlementAmount?: MoneyAmount<WalletCurrency>
  unitOfAccountAmount?: MoneyAmount<WalletOrDisplayCurrency>
  receivingWalletDescriptor: { id: string; currency: WalletCurrency }
  canSetAmount: boolean
  canSetMemo: boolean
  canUsePaycode: boolean
  btcWalletId?: string
  usdWalletId?: string
  lnAddressHostname: string
  feesInformation:
    | {
        deposit: {
          minBankFee: string
          minBankFeeThreshold: string
          ratio: string
        }
      }
    | undefined
  info?: { data: InvoiceData }
  onchainAddress?: string
  getOnchainFullUriFn?: (params: UriParams) => string
  pr: {
    state: string
    info?: { data?: InvoiceData }
  }
  isAssetToggleDisabled: boolean
  shouldShowAutoConvertMinWarning: boolean
  autoConvertMinSats: number | undefined
}
