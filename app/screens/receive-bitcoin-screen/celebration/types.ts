import { TransactionFragment } from "@app/graphql/generated"

export const CelebrationPaymentType = {
  Lightning: "lightning",
  IntraLedger: "intraledger",
  Onchain: "onchain",
} as const

export type CelebrationPaymentType =
  (typeof CelebrationPaymentType)[keyof typeof CelebrationPaymentType]

/** A settled incoming payment offered to the celebration. Custodial updates and
 *  self-custodial payments both arrive as a TransactionFragment, the shape the
 *  transaction details screen reads from the cache. */
export type CelebrationCandidate = {
  transaction: TransactionFragment
  paymentType: CelebrationPaymentType
  /** Lightning only: lets Receive skip its own haptic for the invoice celebrated here. */
  paymentHash?: string
  /** Checks it against the moment the app came to the foreground even for on-chain. Set
   *  for self-custodial payments, whose time is when they settled (for a deposit, when it
   *  was claimed), so a wallet sync replaying old deposits never fires. */
  createdAtIsSettlement?: boolean
}

export const CelebrationSuppressReason = {
  BelowMinimum: "below_minimum",
  BlockedRoute: "blocked_route",
  OptedOut: "opted_out",
  BalanceHidden: "balance_hidden",
} as const

export type CelebrationSuppressReason =
  (typeof CelebrationSuppressReason)[keyof typeof CelebrationSuppressReason]

export const CelebrationCloseAction = {
  Close: "close",
  Details: "details",
  Back: "back",
  X: "x",
  Background: "background",
} as const

export type CelebrationCloseAction =
  (typeof CelebrationCloseAction)[keyof typeof CelebrationCloseAction]
