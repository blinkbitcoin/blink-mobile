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
  Pending: "pending",
  ClaimRequired: "claim_required",
} as const

export type DepositStatus = (typeof DepositStatus)[keyof typeof DepositStatus]

export type PendingDeposit = {
  id: string
  address: string
  amount: MoneyAmount<WalletCurrency>
  status: DepositStatus
  claimFee?: MoneyAmount<WalletCurrency>
}

export type ClaimDepositParams = {
  depositId: string
}

export const ConvertDirection = {
  BtcToUsd: "btc_to_usd",
  UsdToBtc: "usd_to_btc",
} as const

export type ConvertDirection = (typeof ConvertDirection)[keyof typeof ConvertDirection]

export type ConvertParams = {
  amount: MoneyAmount<WalletCurrency>
  direction: ConvertDirection
}

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
}

export type ConvertAdapter = (params: ConvertParams) => Promise<PaymentAdapterResult>
