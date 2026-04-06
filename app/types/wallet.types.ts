import { WalletCurrency } from "@app/graphql/generated"

import { MoneyAmount } from "./amounts"
import { NormalizedTransaction } from "./transaction.types"
import { WalletDescriptor } from "./wallets"

export type { WalletCurrency }
export type { WalletDescriptor }

export const AccountType = {
  Custodial: "custodial",
  SelfCustodial: "self-custodial",
} as const

export type AccountType = (typeof AccountType)[keyof typeof AccountType]

export const DefaultAccountId = {
  Custodial: `${AccountType.Custodial}-default`,
  SelfCustodial: `${AccountType.SelfCustodial}-default`,
} as const

export const AccountStatus = {
  Available: "available",
  RequiresRestore: "requires_restore",
  Error: "error",
} as const

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus]

export type AccountDescriptor = {
  id: string
  type: AccountType
  label: string
  selected: boolean
  status: AccountStatus
  metadata?: {
    accountId?: string
    userId?: string
    hasBackup?: boolean
  }
}

declare const walletIdBrand: unique symbol

export type WalletId = string & { readonly [walletIdBrand]: true }

export const toWalletId = (id: string): WalletId => id as WalletId

export type WalletIdFactory = {
  createWalletId(providerKey: string, currency: WalletCurrency): WalletId
}

export type WalletState = {
  id: WalletId
  walletCurrency: WalletCurrency
  balance: MoneyAmount<WalletCurrency>
  pendingBalance?: MoneyAmount<WalletCurrency>
  transactions: NormalizedTransaction[]
}

export const ActiveWalletStatus = {
  Ready: "ready",
  Loading: "loading",
  Error: "error",
  Offline: "offline",
  Degraded: "degraded",
  Unavailable: "unavailable",
} as const

export type ActiveWalletStatus =
  (typeof ActiveWalletStatus)[keyof typeof ActiveWalletStatus]

export type ActiveWalletState = {
  wallets: WalletState[]
  status: ActiveWalletStatus
  accountType: AccountType
}
