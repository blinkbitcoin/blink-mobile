/**
 * What the investment agreement is signed with, and the one step that mints it: the
 * figures the app computes from the chosen amount at the price just read, laid out by
 * the labels the agreement's templates give their fields.
 *
 * Who signs, and the rest of the signer's details, are not the app's to say: the e-sign
 * service asks the host for them per user when it mints, and what the host answers is
 * what the document states. The app sends the figures as its input and nothing more.
 *
 * The call that reaches the service is handed in rather than imported, so this module
 * states what is minted and the transport states how, and neither knows the other's
 * details.
 */

import { SATS_PER_BTC } from "@app/hooks/use-price-conversion"

import {
  BTC_DECIMALS,
  type InvestmentTerms,
  resolveInvestmentTerms,
  resolveSettlementQuote,
} from "./investment-terms"

/** The labels the agreement's templates give the figures the app computes. */
export const AGREEMENT_LABELS = {
  units: "number_of_units",
  pricePerUnitUsd: "price_per_unit_usd",
  preMoneyValuationUsd: "pre_money_valuation_usd",
  totalUsd: "total_subscription_usd",
  btcUsdRate: "btc_usd_rate",
  settlementBtc: "settlement_amount_btc",
  rateTimestamp: "rate_timestamp",
} as const

/** Money and the rate are written with cents. */
const USD_DECIMALS = 2

/**
 * The one code the signing component words with the message it was handed, for a mint
 * refused for a reason the signer should read: a request the service would not take.
 * Under any other code it knows, the component replaces the message with its own copy,
 * which would leave the signer tapping retry against a wall.
 */
const REFUSAL_CODE = "VALIDATION_ERROR"

/** The session the service was asked as is no longer good; the component words it. */
const UNAUTHORIZED_CODE = "UNAUTHORIZED"

/** Any other failure is worded by the component; the reason goes to the log. */
const FAILURE_CODE = "ENVELOPE_CREATION_FAILED"

/** The service could not be reached at all, which the component words as a lost
 *  connection rather than as a mint that failed. */
const UNREACHABLE_CODE = "NETWORK_ERROR"

/** The rejection carries a `code` because that is what the signing component reads to
 *  decide the wording; without one it falls back to a code that discards the message. */
const signingError = (message: string, code: string): Error =>
  Object.assign(new Error(message), { code })

export const signingRefusal = (message: string): Error =>
  signingError(message, REFUSAL_CODE)
export const signingUnauthorized = (message: string): Error =>
  signingError(message, UNAUTHORIZED_CODE)
export const signingFailure = (message: string): Error =>
  signingError(message, FAILURE_CODE)
export const signingUnreachable = (message: string): Error =>
  signingError(message, UNREACHABLE_CODE)

/** A value written onto the document, which the signer cannot change. */
type LockedValue = { value: string; locked: true }

/** What the envelope is written with, keyed by the label its templates give each field. */
export type AgreementPrefill = Record<string, LockedValue>

/**
 * Terms with the price feed answered: the agreement fixes a rate the payment is then owed
 * at, so it cannot be minted while these are missing.
 */
type QuotedInvestmentTerms = InvestmentTerms &
  Required<Pick<InvestmentTerms, "btcUsdRate" | "settlementBtc" | "rateTimestamp">>

const isQuoted = (terms: InvestmentTerms): terms is QuotedInvestmentTerms =>
  terms.btcUsdRate !== undefined &&
  terms.settlementBtc !== undefined &&
  terms.rateTimestamp !== undefined

/** Nothing the agreement states is the signer's to change, so every value is locked. */
const locked = (value: unknown): LockedValue => ({ value: String(value), locked: true })

/** The figures the document is written with, every one locked. */
const resolveAgreementPrefill = (terms: QuotedInvestmentTerms): AgreementPrefill => ({
  [AGREEMENT_LABELS.units]: locked(terms.units),
  [AGREEMENT_LABELS.pricePerUnitUsd]: locked(terms.pricePerUnitUsd.toFixed(USD_DECIMALS)),
  [AGREEMENT_LABELS.preMoneyValuationUsd]: locked(
    terms.preMoneyValuationUsd.toFixed(USD_DECIMALS),
  ),
  [AGREEMENT_LABELS.totalUsd]: locked(terms.totalUsd.toFixed(USD_DECIMALS)),
  [AGREEMENT_LABELS.btcUsdRate]: locked(terms.btcUsdRate.toFixed(USD_DECIMALS)),
  [AGREEMENT_LABELS.settlementBtc]: locked(terms.settlementBtc.toFixed(BTC_DECIMALS)),
  [AGREEMENT_LABELS.rateTimestamp]: locked(terms.rateTimestamp),
})

/** The satoshis the agreement settles at, which is the figure the transfer step bills:
 *  the same bitcoin the document names, not a fresh conversion at a later price. */
const resolveSettlementSats = (terms: QuotedInvestmentTerms): number =>
  Math.round(terms.settlementBtc * SATS_PER_BTC)

/** A minted signing session: the url the signer opens, and the envelope it belongs to. */
export type MintedAgreement = {
  url: string
  envelopeId?: string
}

/** The call that reaches the service with the figures the document says. */
type MintAgreement = (prefill: AgreementPrefill) => Promise<MintedAgreement>

type MintInvestmentAgreementInput = {
  totalUsd: number
  /** The price of one bitcoin in whole cents as the feed last answered, or null
   *  before it has. */
  usdCentsPerBtc: number | null
  mint: MintAgreement
  /** The moment the rate is quoted at, which the agreement stamps. */
  now?: Date
}

/**
 * Mints the agreement from what the app knows at this moment. A price that has not
 * answered yet is a failure the retry can cure, so it is filed under the component's own
 * copy. Who signs is the host's answer, not the app's: a user the host has no signer
 * for is refused by the service, under the copy the component has for a failed mint.
 *
 * The settlement is what this call computed and asked the service to write, so the
 * transfer step bills the figure the document names. That holds while the host passes
 * the figures through as sent, which is how this app's host answers; a host that decided
 * the figures itself would have to hand them back for the billed figure to still agree.
 */
export const mintInvestmentAgreement = async ({
  totalUsd,
  usdCentsPerBtc,
  mint,
  now = new Date(),
}: MintInvestmentAgreementInput): Promise<{
  minted: MintedAgreement
  settlementSats: number
}> => {
  const terms = resolveInvestmentTerms(
    totalUsd,
    resolveSettlementQuote(usdCentsPerBtc, now),
  )

  if (!isQuoted(terms)) {
    throw signingFailure("the bitcoin price is not available yet")
  }

  const minted = await mint(resolveAgreementPrefill(terms))

  return { minted, settlementSats: resolveSettlementSats(terms) }
}
