import { describe, expect, it } from "@jest/globals"
import { PaymentMethod } from "@breeztech/breez-sdk-spark-react-native"

import {
  amountBucketForPayment,
  amountBucketForSats,
  ScAmountBucket,
} from "@app/self-custodial/amount-bucket"

const USDB = "btkn1usdb"
const PRICE = { usdPerBtc: 100_000, usdTokenIdentifier: USDB }

/** A USDB payment of `usd` dollars, in base units of a 6-decimal token. */
const usdbPayment = (usd: number, identifier = USDB) => ({
  amount: BigInt(Math.round(usd * 1_000_000)),
  method: PaymentMethod.Token,
  details: {
    tag: "Token",
    inner: { metadata: { identifier, decimals: 6 } },
  } as never,
})

describe("amountBucketForSats", () => {
  it.each([
    [0n, ScAmountBucket.Under1k],
    [999n, ScAmountBucket.Under1k],
    [1_000n, ScAmountBucket.From1kTo10k],
    [9_999n, ScAmountBucket.From1kTo10k],
    [10_000n, ScAmountBucket.From10kTo100k],
    [99_999n, ScAmountBucket.From10kTo100k],
    [100_000n, ScAmountBucket.Over100k],
    [2n ** 64n, ScAmountBucket.Over100k],
  ])("bands %p sats as %s", (sats, bucket) => {
    expect(amountBucketForSats(sats)).toBe(bucket)
  })
})

describe("amountBucketForPayment", () => {
  it.each([
    PaymentMethod.Lightning,
    PaymentMethod.Spark,
    PaymentMethod.Deposit,
    PaymentMethod.Withdraw,
  ])("bands a %s payment by its amount in sats", (method) => {
    expect(amountBucketForPayment({ amount: 5_000n, method }, PRICE)).toBe(
      ScAmountBucket.From1kTo10k,
    )
  })

  it("bands a bitcoin payment without needing a price", () => {
    expect(
      amountBucketForPayment(
        { amount: 500n, method: PaymentMethod.Lightning },
        { usdPerBtc: undefined, usdTokenIdentifier: null },
      ),
    ).toBe(ScAmountBucket.Under1k)
  })

  it.each([
    /** $1 at $100,000/BTC is 1,000 sats: the lower edge of 1k_10k. */
    [1, ScAmountBucket.From1kTo10k],
    [0.99, ScAmountBucket.Under1k],
    [9.99, ScAmountBucket.From1kTo10k],
    [10, ScAmountBucket.From10kTo100k],
    [100, ScAmountBucket.Over100k],
  ])("bands a $%p USDB payment in sats at the held price", (usd, bucket) => {
    expect(amountBucketForPayment(usdbPayment(usd), PRICE)).toBe(bucket)
  })

  it.each([
    ["no price", { usdPerBtc: undefined, usdTokenIdentifier: USDB }],
    ["a zero price", { usdPerBtc: 0, usdTokenIdentifier: USDB }],
    ["a negative price", { usdPerBtc: -1, usdTokenIdentifier: USDB }],
    ["a non-finite price", { usdPerBtc: Number.NaN, usdTokenIdentifier: USDB }],
    ["no dollar token on this network", { usdPerBtc: 100_000, usdTokenIdentifier: null }],
  ])("leaves a USDB payment unbanded with %s", (_label, price) => {
    expect(amountBucketForPayment(usdbPayment(5), price)).toBeNull()
  })

  it("leaves a token other than the dollar token unbanded", () => {
    expect(amountBucketForPayment(usdbPayment(5, "btkn1other"), PRICE)).toBeNull()
  })

  it("leaves a token payment without token details unbanded", () => {
    expect(
      amountBucketForPayment({ amount: 5_000_000n, method: PaymentMethod.Token }, PRICE),
    ).toBeNull()
  })

  it("leaves a token payment whose details are not token details unbanded", () => {
    expect(
      amountBucketForPayment(
        {
          amount: 5_000_000n,
          method: PaymentMethod.Token,
          details: { tag: "Spark", inner: {} } as never,
        },
        PRICE,
      ),
    ).toBeNull()
  })

  it.each([
    ["a negative", -100_000],
    ["an infinite", Number.POSITIVE_INFINITY],
  ])("does not band even a zero-dollar payment at %s price", (_label, usdPerBtc) => {
    expect(
      amountBucketForPayment(usdbPayment(0), { usdPerBtc, usdTokenIdentifier: USDB }),
    ).toBeNull()
  })

  it("leaves a payment with no amount unbanded", () => {
    expect(amountBucketForPayment({ method: PaymentMethod.Lightning }, PRICE)).toBeNull()
  })

  it("leaves a negative amount unbanded", () => {
    expect(
      amountBucketForPayment({ amount: -1n, method: PaymentMethod.Lightning }, PRICE),
    ).toBeNull()
  })

  it("leaves an unknown method unbanded", () => {
    expect(
      amountBucketForPayment({ amount: 5_000n, method: 99 as PaymentMethod }, PRICE),
    ).toBeNull()
  })
})
