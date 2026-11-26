import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { CardCurrency, MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { DepositFeesInformation } from "@app/utils/deposit-fees"

import { InvoiceType, PaymentRequestStateType } from "./index.types"

type UriParams = { uppercase?: boolean; prefix?: boolean }

/** How a user's request for a fresh on-chain address ended. */
export const NewOnchainAddressResult = {
  Created: "Created",
  Failed: "Failed",
  RateLimited: "RateLimited",
  // A wallet switch or a newer request took over; the screen it was for is gone.
  Superseded: "Superseded",
} as const
export type NewOnchainAddressResultType =
  (typeof NewOnchainAddressResult)[keyof typeof NewOnchainAddressResult]

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
 * self-custodial one in `@app/self-custodial/hooks`; the card deposit hook beside
 * the custodial one implements it for the Card Balance. It lives with the screen
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
  /** Self-custodial and card deposits: no address arrived and none is on the way. */
  onchainAddressFailed?: boolean
  getOnchainFullUriFn?: (params: UriParams) => string
  /** Self-custodial only; the custodial screen asks the API for its new address. */
  generateNewOnchainAddress?: () => Promise<NewOnchainAddressResultType>
  pr: {
    state?: PaymentRequestStateType
    info?: { data?: ReceiveInvoiceInfo }
  } | null
  isAssetToggleDisabled?: boolean
  shouldShowAutoConvertMinWarning?: boolean
  autoConvertMinSats?: number
  autoConvertMinFiat?: string
  /** Card deposits only: the payment lands in the Card Balance, which the pill
   *  names and no toggle can change. */
  destination?: CardCurrency
  /** Card deposits only: shown where the QR goes until an amount is set, since
   *  blink-card mints an invoice or an address only for an amount. */
  amountPrompt?: string
  /** Card deposits only: shown while a payment that arrived is being credited. */
  convertingMessage?: string
  /** Card deposits only: why the invoice failed, when it is more than an error. */
  errorMessage?: string
  /** Card deposits only: why the address failed, since the card has no New to retry. */
  onchainErrorMessage?: string
  /** Card deposits only: the on-chain page was opened, so its address is minted. */
  requestOnchainAddress?: () => void
}
