/**
 * An account's place in the card investment: invited and not yet signed, or signed and
 * moving towards the payment, until the investor closes the welcome that follows it.
 *
 * Kept on device because no backend records the investment yet: the home reads it to
 * hold the invitation open, to steer the investor back to the payment, and to welcome
 * them once it is made. Kept for a day from its latest moment, the same life the
 * agreement and its payment link are given; after that it is read as nothing.
 */
export type CardInvestmentRecord = CardInvestmentInvitation | CardInvestmentProgress

/**
 * Opened the invitation and left before signing. The server's own invitation card is
 * gone the moment it is tapped, so this is what keeps a way back into the flow.
 */
export type CardInvestmentInvitation = {
  /** When the investor first opened the flow, in milliseconds. */
  invitedAt: number
}

/** Signed, from the moment the agreement is signed until the welcome is closed. */
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

/** Whether the record is past the signature; an invitation carries no amount. Checked
 *  to be an object first, because the record comes off disk and `in` throws on anything
 *  else. */
export const isSignedCardInvestment = (
  record: CardInvestmentRecord,
): record is CardInvestmentProgress =>
  typeof record === "object" && record !== null && "selectedAmountUsd" in record

/**
 * The one thing the home says about an investment in progress, in the order the flow
 * moves through them.
 *
 * Only the last one can be closed. An invitation is the way back into a flow that was
 * left, and a signed agreement cannot be unsigned, so until it is paid the home keeps
 * pointing at the next step rather than offering a way to hide it.
 */
export const CardInvestmentBulletinKind = {
  /** Opened and left before signing: the investor is sent back to the start. */
  Invited: "invited",
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

/** The kinds that only exist once an agreement is signed, and so carry its record. */
export type SignedCardInvestmentBulletinKind = Exclude<
  CardInvestmentBulletinKind,
  typeof CardInvestmentBulletinKind.Invited
>

/** What the home renders: which card, the investment it is about, and how to close it.
 *  An invitation has no investment yet, so its card carries none. */
export type CardInvestmentBulletinState =
  | {
      kind: typeof CardInvestmentBulletinKind.Invited
      progress: null
      dismiss: () => void
    }
  | {
      kind: SignedCardInvestmentBulletinKind
      progress: CardInvestmentProgress
      dismiss: () => void
    }
