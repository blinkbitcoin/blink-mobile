/**
 * A card investment the account has signed for, from the moment the agreement is signed
 * until the investor closes the welcome that follows the payment.
 *
 * Kept on device because no backend records the investment yet: the home reads it to
 * steer the investor back to the payment, and to welcome them once it is made. Kept for
 * a day from its latest moment, the same life the agreement and its payment link are
 * given; after that it is read as nothing.
 */
export type CardInvestmentProgress = {
  /** The amount the investor chose, which every later step derives its figures from. */
  selectedAmountUsd: number
  /** When the agreement was signed, in milliseconds. */
  signedAt: number
  /** The satoshis the signed agreement settles at, when the mint named them. */
  settlementSats?: number
  /** When the payment went through; absent while it is still owed. */
  paidAt?: number
  /** The invoice last issued for the payment, kept so a return to the transfer step pays
   *  the same claim rather than a second one: a payment that went through without being
   *  recorded then meets an invoice the recipient has already settled, not a fresh one. */
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

/** What the home renders: which card, the investment it is about, and how to close it. */
export type CardInvestmentBulletinState = {
  kind: CardInvestmentBulletinKind
  progress: CardInvestmentProgress
  dismiss: () => void
}
