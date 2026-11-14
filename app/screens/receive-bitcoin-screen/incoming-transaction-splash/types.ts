import { TransactionFragment } from "@app/graphql/generated"

/** From the start of the iris to the controls taking taps: the entrance is over. */
export const SPLASH_SETTLE_MS = 900

export const SplashPaymentType = {
  Lightning: "lightning",
  IntraLedger: "intraledger",
  Onchain: "onchain",
} as const

export type SplashPaymentType = (typeof SplashPaymentType)[keyof typeof SplashPaymentType]

/** An incoming payment offered to the splash: settled for Lightning and intraledger,
 *  detected and still pending for on-chain. Custodial updates and self-custodial
 *  payments both arrive as a TransactionFragment, the shape the transaction details
 *  screen reads from the cache. */
export type SplashCandidate = {
  transaction: TransactionFragment
  paymentType: SplashPaymentType
  /** Lightning only: lets Receive skip its own haptic for the invoice shown in the splash. */
  paymentHash?: string
  /** Checks it against the moment the app came to the foreground even for on-chain. Set
   *  for self-custodial payments, so a wallet sync replaying old ones never fires. */
  createdAtIsSettlement?: boolean
  /** Self-custodial: the SDK reported this payment pending earlier in this session, so it
   *  settled live. Its time is when it was created (for a receive, when its invoice was),
   *  which can be well before the app last came to the foreground. */
  claimSeenLive?: boolean
  /** A self-custodial deposit the SDK has seen but not claimed. It is not a transaction
   *  yet, so Details opens the unclaimed deposits screen instead. */
  unclaimedDeposit?: boolean
  /** Self-custodial: the payment is not in the wallet's transaction list yet, so the
   *  details screen could not find it. Details stays inactive until it is. */
  detailsPending?: boolean
  /** Self-custodial, before a price has loaded: the display amount is the raw sats, not
   *  a display-currency value, so the screen shows sats alone. */
  unpriced?: boolean
}

export const SplashSuppressReason = {
  BelowMinimum: "below_minimum",
  BlockedRoute: "blocked_route",
  OptedOut: "opted_out",
} as const

export type SplashSuppressReason =
  (typeof SplashSuppressReason)[keyof typeof SplashSuppressReason]
