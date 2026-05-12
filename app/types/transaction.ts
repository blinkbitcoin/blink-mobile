import { WalletCurrency } from "@app/graphql/generated"

import { MoneyAmount } from "./amounts"
import { AccountType } from "./wallet"

export const PaymentType = {
  Lightning: "lightning",
  Onchain: "onchain",
  Spark: "spark",
  Conversion: "conversion",
} as const

export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType]

export const TransactionDirection = {
  Send: "send",
  Receive: "receive",
} as const

export type TransactionDirection =
  (typeof TransactionDirection)[keyof typeof TransactionDirection]

export const TransactionStatus = {
  Pending: "pending",
  Completed: "completed",
  Failed: "failed",
} as const

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus]

export type NormalizedTransaction = {
  id: string
  amount: MoneyAmount<WalletCurrency>
  direction: TransactionDirection
  status: TransactionStatus
  timestamp: number
  paymentType: PaymentType
  memo?: string
  lnAddress?: string
  tokenTicker?: string
  isConversion?: boolean
  fee?: MoneyAmount<WalletCurrency>
  sourceAccountType?: AccountType
}
