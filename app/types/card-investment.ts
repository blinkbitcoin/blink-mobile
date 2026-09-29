/**
 * A card investment the account has signed for: from the moment the agreement is signed,
 * through the payment, to the welcome that follows it.
 *
 * Kept on device because no backend records the investment yet: the home reads it to
 * steer the investor back to the payment, and to welcome them once it is made. It does
 * not lapse. Once signed, the record is also the mark that this account has signed, and
 * the flow refuses to be walked a second time while it stands.
 */
export type CardInvestmentProgress = {
  /** The amount the investor chose, which every later step derives its figures from. */
  selectedAmountUsd: number
  /** When the agreement was signed, in milliseconds. */
  signedAt: number
  /** The satoshis the signed agreement settles at, when the mint named them. */
  settlementSats?: number
  /** The e-sign envelope the agreement was signed in, when the mint named it: what a
   *  server-side record of the signature can be reconciled against. */
  envelopeId?: string
  /** When the payment went through; absent while it is still owed. */
  paidAt?: number
  /** When the investor closed the welcome. The record stays past that, as the mark that
   *  this account signed; only the card goes. */
  welcomeDismissedAt?: number
  /** The invoice last issued for the payment, kept so a return to the transfer step pays
   *  the same claim rather than a second one, and so a payment that went through without
   *  being recorded can be found in the ledger before another invoice is minted. */
  invoice?: CardInvestmentInvoice
}

export type CardInvestmentInvoice = {
  paymentRequest: string
  /** When it was issued, in milliseconds; an invoice is only reused while it can still
   *  be paid. */
  issuedAt: number
}

/**
 * The one thing the home says about an investment in progress, in the order the flow
 * moves through them.
 *
 * Only the last one can be closed. A signed agreement cannot be unsigned, so until it is
 * paid the home keeps pointing at the payment rather than offering a way to hide it.
 */
export const CardInvestmentBulletinKind = {
  /** Signed, and the money is not there: the investor is sent to deposit. */
  Insufficient: "insufficient",
  /** Signed, and the money is there but spread over both wallets: the investor is sent
   *  to convert, since a payment draws on one. */
  SplitFunds: "splitFunds",
  /** Signed, still short, and a deposit is on its way in. */
  DepositPending: "depositPending",
  /** Signed and covered: the investor is sent back to pay. */
  Ready: "ready",
  /** Paid: welcomed, until they close it. */
  Shareholder: "shareholder",
} as const

export type CardInvestmentBulletinKind =
  (typeof CardInvestmentBulletinKind)[keyof typeof CardInvestmentBulletinKind]

/**
 * What the ledger says about the investment's invoice on record.
 *
 * Not being able to ask is kept apart from asking and finding nothing, because they call
 * for opposite answers: an invoice the ledger has no send for was never paid and may be
 * replaced, while one it could not be asked about may well have been paid, and replacing
 * it, or forgetting a payment on its way, could have the investor pay twice.
 */
export const CardInvestmentPaymentLookup = {
  Settled: "settled",
  Pending: "pending",
  /** Every wallet was asked and none holds a send for the invoice. */
  NotFound: "notFound",
  /** The ledger could not be asked: no network, no wallets, or a request that failed. */
  Unknown: "unknown",
} as const

export type CardInvestmentPaymentLookup =
  (typeof CardInvestmentPaymentLookup)[keyof typeof CardInvestmentPaymentLookup]

/** What the home renders: which card, the investment it is about, and how to close it. */
export type CardInvestmentBulletinState = {
  kind: CardInvestmentBulletinKind
  progress: CardInvestmentProgress
  dismiss: () => void
}
