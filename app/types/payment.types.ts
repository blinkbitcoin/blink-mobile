import { WalletCurrency } from "@app/graphql/generated"

import { MoneyAmount } from "./amounts"

export type PaymentError = {
  message: string
  code?: string
}

export const PaymentResultStatus = {
  Success: "success",
  Failed: "failed",
  Pending: "pending",
} as const

export type PaymentResultStatus =
  (typeof PaymentResultStatus)[keyof typeof PaymentResultStatus]

export type PaymentAdapterResult = {
  status: PaymentResultStatus
  errors?: PaymentError[]
  extraInfo?: {
    arrivalAtMempoolEstimate?: number
    preimage?: string | null
  }
}

export const FeeTier = {
  Slow: "slow",
  Medium: "medium",
  Fast: "fast",
} as const

export type FeeTier = (typeof FeeTier)[keyof typeof FeeTier]

export const FEE_TIER_ETA_MINUTES = {
  fast: 10,
  medium: 30,
  slow: 60,
} as const

export type SendPaymentParams = {
  destination: string
  amount?: MoneyAmount<WalletCurrency>
  memo?: string
  feeTier?: FeeTier
}

export type ReceiveLightningParams = {
  amount?: MoneyAmount<WalletCurrency>
  memo?: string
}

export const FeeQuoteType = {
  Lightning: "lightning",
  Onchain: "onchain",
  Claim: "claim",
} as const

export type FeeQuoteType = (typeof FeeQuoteType)[keyof typeof FeeQuoteType]

export const FeeMode = {
  PaySeparately: "pay_separately",
} as const

export type FeeMode = (typeof FeeMode)[keyof typeof FeeMode]

export type FeeQuote =
  | {
      paymentType: typeof FeeQuoteType.Lightning
      feeAmount: MoneyAmount<WalletCurrency>
      errors?: PaymentError[]
    }
  | {
      paymentType: typeof FeeQuoteType.Onchain
      feeAmount: MoneyAmount<WalletCurrency>
      feeTier: FeeTier
      feeMode: FeeMode
      recipientAmount: MoneyAmount<WalletCurrency>
      totalDebited: MoneyAmount<WalletCurrency>
      confirmationEtaMinutes?: number
      errors?: PaymentError[]
    }
  | {
      paymentType: typeof FeeQuoteType.Claim
      feeAmount: MoneyAmount<WalletCurrency>
      errors?: PaymentError[]
    }

export const DepositStatus = {
  Immature: "immature",
  Claimable: "claimable",
  FeeExceeded: "fee_exceeded",
  Error: "error",
  Refunded: "refunded",
} as const

export type DepositStatus = (typeof DepositStatus)[keyof typeof DepositStatus]

export const DepositErrorReason = {
  FeeExceeded: "fee_exceeded",
  MissingUtxo: "missing_utxo",
  BelowDust: "below_dust",
  Generic: "generic",
} as const

export type DepositErrorReason =
  (typeof DepositErrorReason)[keyof typeof DepositErrorReason]

export type PendingDeposit = {
  id: string
  txid: string
  vout: number
  amount: MoneyAmount<WalletCurrency>
  status: DepositStatus
  errorReason: DepositErrorReason | null
  requiredFeeSats?: number
  errorMessage?: string
}

export type ClaimDepositParams = {
  depositId: string
  maxFeeSats?: number
}

export type RefundDepositParams = {
  depositId: string
  destinationAddress: string
  feeRateSatPerVb: number
}

export const ConvertDirection = {
  BtcToUsd: "btc_to_usd",
  UsdToBtc: "usd_to_btc",
} as const

export type ConvertDirection = (typeof ConvertDirection)[keyof typeof ConvertDirection]

export const convertDirectionFromCurrency = (
  fromCurrency: WalletCurrency,
): ConvertDirection =>
  fromCurrency === WalletCurrency.Btc
    ? ConvertDirection.BtcToUsd
    : ConvertDirection.UsdToBtc

export const oppositeWalletCurrency = (currency: WalletCurrency): WalletCurrency =>
  currency === WalletCurrency.Btc ? WalletCurrency.Usd : WalletCurrency.Btc

export type ConvertParams = {
  fromAmount: MoneyAmount<WalletCurrency>
  toAmount: MoneyAmount<WalletCurrency>
  direction: ConvertDirection
}

export type ConversionLimits = {
  minFromAmount: number | null
  minToAmount: number | null
}

export const ConvertErrorCode = {
  BelowMinimum: "below_minimum",
  LimitsUnavailable: "limits_unavailable",
} as const

export type ConvertErrorCode = (typeof ConvertErrorCode)[keyof typeof ConvertErrorCode]

export type SendPaymentAdapter = (
  params: SendPaymentParams,
) => Promise<PaymentAdapterResult>

export type GetFeeAdapter = (params: SendPaymentParams) => Promise<FeeQuote | null>

export type ReceiveLightningAdapter = (params: ReceiveLightningParams) => Promise<{
  invoice?: string
  errors?: PaymentError[]
}>

export type ReceiveOnchainAdapter = () => Promise<{
  address?: string
  errors?: PaymentError[]
}>

export type ListPendingDepositsAdapter = () => Promise<{
  deposits: PendingDeposit[]
  errors?: PaymentError[]
}>

export type ClaimDepositAdapter = {
  getClaimFee: (params: ClaimDepositParams) => Promise<FeeQuote | null>
  claimDeposit: (params: ClaimDepositParams) => Promise<PaymentAdapterResult>
  refundDeposit: (params: RefundDepositParams) => Promise<PaymentAdapterResult>
}

export type ConvertAdapter = (params: ConvertParams) => Promise<PaymentAdapterResult>

export const ConvertAmountAdjustment = {
  FlooredToMin: "floored_to_min",
  IncreasedToAvoidDust: "increased_to_avoid_dust",
} as const

export type ConvertAmountAdjustment =
  (typeof ConvertAmountAdjustment)[keyof typeof ConvertAmountAdjustment]

export type ConvertQuote = {
  feeAmount: MoneyAmount<typeof WalletCurrency.Usd>
  amountAdjustment?: ConvertAmountAdjustment
  execute: () => Promise<PaymentAdapterResult>
}

export type GetConversionQuoteAdapter = (
  params: ConvertParams,
) => Promise<ConvertQuote | null>
