import { TransactionFragment } from "@app/graphql/generated"

export const SplashPaymentType = {
  Lightning: "lightning",
  IntraLedger: "intraledger",
  Onchain: "onchain",
} as const

export type SplashPaymentType = (typeof SplashPaymentType)[keyof typeof SplashPaymentType]

/** A settled incoming payment offered to the splash. Custodial updates and
 *  self-custodial payments both arrive as a TransactionFragment, the shape the
 *  transaction details screen reads from the cache. */
export type SplashCandidate = {
  transaction: TransactionFragment
  paymentType: SplashPaymentType
  /** Lightning only: lets Receive skip its own haptic for the invoice shown in the splash. */
  paymentHash?: string
  /** Checks it against the moment the app came to the foreground even for on-chain. Set
   *  for self-custodial payments, whose time is when they settled (for a deposit, when it
   *  was claimed), so a wallet sync replaying old deposits never fires. */
  createdAtIsSettlement?: boolean
}

export const SplashSuppressReason = {
  BelowMinimum: "below_minimum",
  BlockedRoute: "blocked_route",
  OptedOut: "opted_out",
} as const

export type SplashSuppressReason =
  (typeof SplashSuppressReason)[keyof typeof SplashSuppressReason]

export const SplashCloseAction = {
  Close: "close",
  Details: "details",
  Back: "back",
  X: "x",
  Background: "background",
} as const

export type SplashCloseAction = (typeof SplashCloseAction)[keyof typeof SplashCloseAction]
