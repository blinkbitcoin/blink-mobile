import { LnUrlPayServiceResponse, LNURLPaySuccessAction } from "lnurl-pay"
import {
  GraphQlApplicationError,
  IntraLedgerPaymentSendMutationHookResult,
  IntraLedgerUsdPaymentSendMutationHookResult,
  LnInvoicePaymentSendMutationHookResult,
  LnNoAmountInvoicePaymentSendMutationHookResult,
  LnNoAmountUsdInvoicePaymentSendMutationHookResult,
  OnChainPaymentSendMutationHookResult,
  OnChainPaymentSendAllMutationHookResult,
  OnChainUsdPaymentSendAsBtcDenominatedMutationHookResult,
  OnChainUsdPaymentSendMutationHookResult,
  PaymentSendResult,
  PayoutSpeed,
  useLnInvoiceFeeProbeMutation,
  useLnNoAmountInvoiceFeeProbeMutation,
  useLnNoAmountUsdInvoiceFeeProbeMutation,
  useLnUsdInvoiceFeeProbeMutation,
  useOnChainTxFeeLazyQuery,
  useOnChainUsdTxFeeAsBtcDenominatedLazyQuery,
  useOnChainUsdTxFeeLazyQuery,
  WalletCurrency,
  Transaction,
} from "@app/graphql/generated"
import {
  BtcMoneyAmount,
  MoneyAmount,
  WalletAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { PaymentType as SelfCustodialPaymentType } from "@app/types/transaction"
import { WalletDescriptor } from "@app/types/wallets"
import { PaymentType } from "@blinkbitcoin/blink-client"

export type ConvertMoneyAmount = <W extends WalletOrDisplayCurrency>(
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
  toCurrency: W,
) => MoneyAmount<W>

/**
 * Carrier for the payment's X-Idempotency-Key. It is a mutable holder rather than a
 * string so the key can be minted lazily, at send time, where a CSPRNG failure is
 * catchable — while still being stable across every PaymentDetail rebuild that does not
 * change the payment intent. The intent is the money movement itself: destination,
 * settlement amount and source wallet. Setters that leave those three alone thread this
 * same object through, so a user who backs out of the confirmation screen and re-enters
 * retries under the original key and the backend can refuse the duplicate. Setters that
 * change the wire payload drop it, so the next send mints a fresh key and a genuinely
 * different payment is never deduped against the previous one.
 *
 * Mutating it from the send path is deliberate: the details screen keeps rebuilding the
 * detail underneath the confirmation screen, and a plain string value could not carry a
 * key minted after those rebuilds back to the intent. Do not "clean this up" into a value.
 */
export type IdempotencyKeyRef = { current?: string }

export type BaseCreatePaymentDetailsParams<T extends WalletCurrency> = {
  convertMoneyAmount: ConvertMoneyAmount
  sendingWalletDescriptor: WalletDescriptor<T>
  destinationSpecifiedMemo?: string
  senderSpecifiedMemo?: string
  idempotencyKeyRef?: IdempotencyKeyRef
}

export type SetSendingWalletDescriptor<T extends WalletCurrency> = (
  sendingWalletDescriptor: WalletDescriptor<T>,
) => PaymentDetail<T>

export type GetFeeParams = {
  lnInvoiceFeeProbe: ReturnType<typeof useLnInvoiceFeeProbeMutation>["0"]
  lnNoAmountInvoiceFeeProbe: ReturnType<typeof useLnNoAmountInvoiceFeeProbeMutation>["0"]
  lnNoAmountUsdInvoiceFeeProbe: ReturnType<
    typeof useLnNoAmountUsdInvoiceFeeProbeMutation
  >["0"]
  lnUsdInvoiceFeeProbe: ReturnType<typeof useLnUsdInvoiceFeeProbeMutation>["0"]
  onChainTxFee: ReturnType<typeof useOnChainTxFeeLazyQuery>["0"]
  onChainUsdTxFee: ReturnType<typeof useOnChainUsdTxFeeLazyQuery>["0"]
  onChainUsdTxFeeAsBtcDenominated: ReturnType<
    typeof useOnChainUsdTxFeeAsBtcDenominatedLazyQuery
  >["0"]
}

export type GetFee<T extends WalletCurrency> = (getFeeFns: GetFeeParams) => Promise<{
  amount?: WalletAmount<T> | null | undefined
  errors?: readonly GraphQlApplicationError[]
}>

export type SendPaymentMutationParams = {
  lnInvoicePaymentSend: LnInvoicePaymentSendMutationHookResult["0"]
  lnNoAmountInvoicePaymentSend: LnNoAmountInvoicePaymentSendMutationHookResult["0"]
  lnNoAmountUsdInvoicePaymentSend: LnNoAmountUsdInvoicePaymentSendMutationHookResult["0"]
  onChainPaymentSend: OnChainPaymentSendMutationHookResult["0"]
  onChainPaymentSendAll: OnChainPaymentSendAllMutationHookResult["0"]
  onChainUsdPaymentSend: OnChainUsdPaymentSendMutationHookResult["0"]
  onChainUsdPaymentSendAsBtcDenominated: OnChainUsdPaymentSendAsBtcDenominatedMutationHookResult["0"]
  intraLedgerPaymentSend: IntraLedgerPaymentSendMutationHookResult["0"]
  intraLedgerUsdPaymentSend: IntraLedgerUsdPaymentSendMutationHookResult["0"]
}

export type SendPaymentMutation = (
  SendPaymentMutationParams: SendPaymentMutationParams,
) => Promise<{
  status: PaymentSendResult | null | undefined
  transaction?: Partial<Transaction> | null | undefined
  errors?: readonly GraphQlApplicationError[]
  extraInfo?: PaymentSendExtraInfo
}>

export type PaymentSendExtraInfo = {
  arrivalAtMempoolEstimate?: number
  preimage?: string | null
  successAction?: LNURLPaySuccessAction
}

export type SetAmount<T extends WalletCurrency> = (
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>,
  sendMax?: boolean,
) => PaymentDetail<T>

export type SetMemo<T extends WalletCurrency> = (memo: string) => PaymentDetail<T>

export type SetInvoice<T extends WalletCurrency> = (params: {
  paymentRequest: string
  paymentRequestAmount: BtcMoneyAmount
}) => PaymentDetail<T>

export type SetSuccessAction<T extends WalletCurrency> = (
  successAction: LNURLPaySuccessAction | undefined,
) => PaymentDetail<T>

export type SetPayoutSpeed<T extends WalletCurrency> = (
  payoutSpeed: PayoutSpeed,
) => PaymentDetail<T>

type BasePaymentDetail<T extends WalletCurrency> = {
  memo?: string
  paymentType:
    | typeof PaymentType.Intraledger
    | typeof PaymentType.Onchain
    | typeof PaymentType.Lightning
    | typeof PaymentType.Lnurl
    | typeof SelfCustodialPaymentType.Spark
  destination: string
  sendingWalletDescriptor: WalletDescriptor<T>
  convertMoneyAmount: ConvertMoneyAmount
  setConvertMoneyAmount: (convertMoneyAmount: ConvertMoneyAmount) => PaymentDetail<T>
  setSendingWalletDescriptor: SetSendingWalletDescriptor<T>
  canSendMax?: boolean
  isSendingMax?: boolean
  setMemo?: SetMemo<T>
  canSetMemo: boolean
  setAmount?: SetAmount<T>
  canSetAmount: boolean
  getFee?: GetFee<T>
  canGetFee: boolean
  sendPaymentMutation?: SendPaymentMutation
  canSendPayment: boolean
  idempotencyKeyRef?: IdempotencyKeyRef
  destinationSpecifiedAmount?: BtcMoneyAmount
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency> // destinationSpecifiedAmount if the invoice has an amount, otherwise the amount that the user is denominating the payment in
  settlementAmount: WalletAmount<T> // the amount that will be subtracted from the sending wallet
  settlementAmountIsEstimated: boolean
}

// memo is defined if canSetMemo is true
export type PaymentDetailSetMemo<T extends WalletCurrency> =
  | {
      setMemo: SetMemo<T>
      canSetMemo: true
    }
  | {
      setMemo?: undefined
      canSetMemo: false
    }

// invoices with amounts cannot set amounts
export type PaymentDetailSetAmount<T extends WalletCurrency> =
  | {
      setAmount: SetAmount<T>
      canSetAmount: true
    }
  | {
      setAmount?: undefined
      canSetAmount: false
      destinationSpecifiedAmount: BtcMoneyAmount // the amount that comes from the destination
    }

export type PaymentDetailSetSuccessAction<T extends WalletCurrency> = {
  setSuccessAction?: SetSuccessAction<T>
  successAction?: LNURLPaySuccessAction
}

/** Only custodial on-chain sends carry a payout speed; every other rail leaves it unset. */
export type PaymentDetailSetPayoutSpeed<T extends WalletCurrency> = {
  setPayoutSpeed?: SetPayoutSpeed<T>
  payoutSpeed?: PayoutSpeed
}

/**
 * Which of the three on-chain fee endpoints answers for a payment. Set by the factory that
 * already picks the endpoint for getFee, so anything quoting fees ahead of the confirmation
 * screen reads it from here instead of re-deriving the same rule and drifting from it.
 */
export const OnchainFeeQuote = {
  Btc: "btc",
  Usd: "usd",
  UsdAsBtcDenominated: "usd_as_btc_denominated",
} as const

export type OnchainFeeQuote = (typeof OnchainFeeQuote)[keyof typeof OnchainFeeQuote]

export type PaymentDetailOnchainFeeQuote = {
  feeQuote?: OnchainFeeQuote
}

// sendPayment and getFee are defined together
export type PaymentDetailSendPaymentGetFee<T extends WalletCurrency> =
  | {
      sendPaymentMutation: SendPaymentMutation
      canSendPayment: true
      getFee: GetFee<T>
      canGetFee: true
    }
  | {
      sendPaymentMutation?: undefined
      canSendPayment: false
      getFee?: undefined
      canGetFee: false
    }

// lnurl has specific properties
type LnurlSpecificProperties<T extends WalletCurrency> =
  | {
      paymentType:
        | typeof PaymentType.Lightning
        | typeof PaymentType.Intraledger
        | typeof PaymentType.Onchain
    }
  | {
      paymentType: typeof PaymentType.Lnurl
      lnurlParams: LnUrlPayServiceResponse
      /** The bolt11 invoice fetched from the lnurl service; set once an invoice exists
       *  (i.e. when the payment is sendable). The lnurl string itself is `destination`. */
      paymentRequest?: string
      setInvoice: SetInvoice<T>
      setSuccessAction: SetSuccessAction<T>
      isMerchant: boolean
    }

// combine all rules together with base type
export type PaymentDetail<T extends WalletCurrency> = BasePaymentDetail<T> &
  LnurlSpecificProperties<T> &
  PaymentDetailSetMemo<T> &
  PaymentDetailSetAmount<T> &
  PaymentDetailSendPaymentGetFee<T> &
  PaymentDetailSetSuccessAction<T> &
  PaymentDetailSetPayoutSpeed<T> &
  PaymentDetailOnchainFeeQuote

export const AmountInvalidReason = {
  InsufficientBalance: "InsufficientBalance",
  InsufficientLimit: "InsufficientLimit",
  NoAmount: "NoAmount",
} as const

export type AmountInvalidReason =
  (typeof AmountInvalidReason)[keyof typeof AmountInvalidReason]

export const LimitType = {
  Withdrawal: "withdrawal",
  Intraledger: "Intraledger",
} as const

export type LimitType = (typeof LimitType)[keyof typeof LimitType]

export type AmountStatus =
  | {
      validAmount: true
    }
  | {
      validAmount: false
      invalidReason: typeof AmountInvalidReason.NoAmount
    }
  | {
      validAmount: false
      invalidReason: typeof AmountInvalidReason.InsufficientBalance
      balance: MoneyAmount<WalletCurrency>
    }
  | {
      validAmount: false
      invalidReason: typeof AmountInvalidReason.InsufficientLimit
      remainingLimit: MoneyAmount<WalletCurrency>
      limitType: LimitType
    }
