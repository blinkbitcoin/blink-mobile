import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { DepositFeesInformation } from "@app/utils/deposit-fees"

import { InvoiceType, PaymentRequestStateType } from "./index.types"

type UriParams = { uppercase?: boolean; prefix?: boolean }

/** The request currently on screen, in the shape the QR and copy actions need. */
export type ReceiveInvoiceInfo = {
  invoiceType: InvoiceType
  paymentRequest?: string
  address?: string
  username?: string
  getFullUriFn: (params: UriParams) => string
  getCopyableInvoiceFn: () => string
}

/**
 * What the receive screen needs from whichever hook is driving it. Both account
 * types implement this: the custodial hook in the screen's own `hooks/`, and the
 * self-custodial one in `@app/self-custodial/hooks`. It lives with the screen
 * because the screen is what the contract is for — a field that only one side can
 * populate is optional and says so, rather than the whole type claiming an owner.
 */
export type ReceivePaymentRequestState = {
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
  receivingWalletDescriptor: { id: string; currency: WalletCurrency }
  canSetAmount: boolean
  canSetMemo: boolean
  canUsePaycode: boolean
  btcWalletId?: string
  usdWalletId?: string
  lnAddressHostname: string
  feesInformation: { deposit: DepositFeesInformation } | undefined
  info?: { data?: ReceiveInvoiceInfo }
  onchainAddress?: string
  getOnchainFullUriFn?: (params: UriParams) => string
  pr: {
    state?: PaymentRequestStateType
    info?: { data?: ReceiveInvoiceInfo }
  } | null
  isAssetToggleDisabled?: boolean
  shouldShowAutoConvertMinWarning?: boolean
  autoConvertMinSats?: number
  autoConvertMinFiat?: string
}
