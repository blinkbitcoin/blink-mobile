/* eslint-disable camelcase */
import {
  PaymentDetails,
  PaymentMethod,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

/**
 * The size of a payment as Enhanced telemetry reports it: one of four bands of its value
 * in sats (Telemetry PRD 2, R26, KB-25). The band is computed here and the amount never
 * leaves this module: no event carries an amount, and a band is not an amount with its
 * digits rounded off, it is a category from a closed list.
 *
 * Each band includes its lower edge: 1,000 sats is `1k_10k`, 100,000 is `over_100k`.
 * The value banded is the payment's own amount, fees excluded.
 */
export const ScAmountBucket = {
  Under1k: "under_1k",
  From1kTo10k: "1k_10k",
  From10kTo100k: "10k_100k",
  Over100k: "over_100k",
} as const

export type ScAmountBucket = (typeof ScAmountBucket)[keyof typeof ScAmountBucket]

/** Compared as bigint: an SDK amount is a U128, and narrowing it to a number first could
 *  move a value across an edge. */
export const amountBucketForSats = (sats: bigint): ScAmountBucket => {
  if (sats < 1_000n) return ScAmountBucket.Under1k
  if (sats < 10_000n) return ScAmountBucket.From1kTo10k
  if (sats < 100_000n) return ScAmountBucket.From10kTo100k
  return ScAmountBucket.Over100k
}

const SATS_PER_BTC = 100_000_000

/** What a dollar payment needs to be banded in sats: the price of one BTC in US dollars,
 *  and the identifier of the dollar token. Either missing leaves a dollar payment
 *  unbanded. */
export type BandingPrice = {
  usdPerBtc: number | undefined
  usdTokenIdentifier: string | null
}

export type BandablePayment = Partial<Pick<Payment, "amount" | "method" | "details">>

/** A dollar (USDB) amount in sats at the given price. Precision does not matter past the
 *  band edges, so a float is enough here; the result is floored to whole sats. */
const tokenAmountInSats = (
  amount: bigint,
  decimals: number,
  usdPerBtc: number,
): bigint | null => {
  /** A zero, negative or non-finite rate is a broken feed entry, not a price. */
  if (!Number.isFinite(usdPerBtc) || usdPerBtc <= 0) return null
  const usd = Number(amount) / 10 ** decimals
  const sats = Math.floor((usd / usdPerBtc) * SATS_PER_BTC)
  return Number.isFinite(sats) && sats >= 0 ? BigInt(sats) : null
}

/**
 * The band of a settled payment, or null when it cannot be told: no amount, a token other
 * than the dollar token, or a dollar payment with no usable price. Null means the event
 * goes out without a band. It never means a fifth band, since KB-25 lists four.
 *
 * Bitcoin methods carry their amount in sats. A dollar send that converted to bitcoin
 * first is a Lightning (or Spark) payment in sats too; only a token payment is in token
 * base units and needs the price.
 */
export const amountBucketForPayment = (
  { amount, method, details }: BandablePayment,
  { usdPerBtc, usdTokenIdentifier }: BandingPrice,
): ScAmountBucket | null => {
  if (typeof amount !== "bigint" || amount < 0n) return null

  switch (method) {
    case PaymentMethod.Lightning:
    case PaymentMethod.Spark:
    case PaymentMethod.Deposit:
    case PaymentMethod.Withdraw:
      return amountBucketForSats(amount)
    case PaymentMethod.Token: {
      if (!details || !PaymentDetails.Token.instanceOf(details)) return null
      const { identifier, decimals } = details.inner.metadata
      if (!usdTokenIdentifier || identifier !== usdTokenIdentifier) return null
      if (usdPerBtc === undefined) return null
      const sats = tokenAmountInSats(amount, decimals, usdPerBtc)
      return sats === null ? null : amountBucketForSats(sats)
    }
    default:
      return null
  }
}
