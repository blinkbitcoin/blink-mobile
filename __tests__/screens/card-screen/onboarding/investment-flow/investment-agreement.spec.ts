import {
  AGREEMENT_LABELS,
  type AgreementQuote,
  isQuoteFresh,
  MAX_QUOTE_AGE_MS,
  mintInvestmentAgreement,
  signingFailure,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-agreement"

/** A round rate, so every figure below can be checked by hand: one bitcoin at $100,000,
 *  in the cents the price feed is read in, so $25,000 buys a quarter of a bitcoin. */
const USD_CENTS_PER_BTC = 10_000_000
/** 22:00 UTC, which Honduras reads as 16:00. */
const QUOTED_AT = new Date("2026-09-14T22:00:00Z")
const TOTAL_USD = 25000

const MINTED = { url: "https://sign.example.test/envelope/1", envelopeId: "envelope-1" }

/** A quote that reached the device as the price service gave it. */
const quoteOf = (usdCentsPerBtc: number): AgreementQuote => ({
  usdCentsPerBtc,
  quotedAt: QUOTED_AT,
  receivedAt: QUOTED_AT,
})

/** The call to the service, which is the one thing this module does not do itself. */
const mint = jest.fn()

const mintWith = (
  overrides: Partial<Parameters<typeof mintInvestmentAgreement>[0]> = {},
) =>
  mintInvestmentAgreement({
    totalUsd: TOTAL_USD,
    quote: quoteOf(USD_CENTS_PER_BTC),
    mint,
    now: QUOTED_AT,
    ...overrides,
  })

/** What the document was written with on the one call made. */
const prefillSent = () =>
  mint.mock.calls[0][0] as Record<string, { value: string; locked: true }>

describe("mintInvestmentAgreement", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mint.mockResolvedValue(MINTED)
  })

  it("hands back what the service minted", async () => {
    await expect(mintWith()).resolves.toMatchObject({ minted: MINTED })
  })

  /** Who signs is the host's answer to the service, never the app's to send. */
  it("asks the mint for the figures alone, with no signer", async () => {
    await mintWith()

    expect(mint).toHaveBeenCalledTimes(1)
    expect(mint.mock.calls[0]).toHaveLength(1)
    expect(Object.keys(prefillSent()).sort()).toEqual(
      Object.values(AGREEMENT_LABELS).sort(),
    )
  })

  it("writes the figures the chosen amount buys, each one locked", async () => {
    await mintWith()

    expect(prefillSent()).toMatchObject({
      [AGREEMENT_LABELS.units]: { value: "25000", locked: true },
      [AGREEMENT_LABELS.pricePerUnitUsd]: { value: "1.00", locked: true },
      [AGREEMENT_LABELS.preMoneyValuationUsd]: { value: "10000000.00", locked: true },
      [AGREEMENT_LABELS.totalUsd]: { value: "25000.00", locked: true },
      [AGREEMENT_LABELS.btcUsdRate]: { value: "100000.00", locked: true },
      [AGREEMENT_LABELS.settlementBtc]: { value: "0.25000000", locked: true },
      [AGREEMENT_LABELS.rateTimestamp]: { value: expect.any(String), locked: true },
    })
  })

  /** The rate on the document is the feed's, cents and all, so what the signer reads is
   *  the price they were quoted rather than a whole-dollar cut of it. */
  it("writes the rate with its cents", async () => {
    await mintWith({ quote: quoteOf(6_712_345) })

    expect(prefillSent()[AGREEMENT_LABELS.btcUsdRate]).toEqual({
      value: "67123.45",
      locked: true,
    })
  })

  /** The transfer step bills this, and it has to be the bitcoin the document names rather
   *  than a fresh conversion at a later price. */
  it("names the satoshis the document settles at", async () => {
    await expect(mintWith()).resolves.toMatchObject({ settlementSats: 25_000_000 })
  })

  /** The document states bitcoin to eight decimals, which is already whole satoshis; the
   *  rounding only guards against the float that multiplication leaves behind. */
  it("names whole satoshis", async () => {
    const { settlementSats } = await mintWith({
      totalUsd: 1000,
      quote: quoteOf(7_000_000),
    })

    expect(Number.isInteger(settlementSats)).toBe(true)
    expect(settlementSats).toBe(1_428_571)
  })

  /** A product that lands a hair under the whole satoshi: 0.08388607 bitcoin times a
   *  hundred million is 8388606.999999999 in floating point, and a fractional satoshi
   *  count would reach the invoice. */
  it("rounds a float that lands a hair under the whole satoshi", async () => {
    const { settlementSats } = await mintWith({
      totalUsd: 1000,
      quote: quoteOf(1_192_093),
    })

    expect(settlementSats).toBe(8_388_607)
  })

  /** The agreement fixes a rate the payment is then owed at, so a guessed one would be
   *  worse than none: the step fails under the component's own copy and the retry reads
   *  the price again. */
  it("does not mint before the price feed has answered", async () => {
    await expect(mintWith({ quote: null })).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
    })

    expect(mint).not.toHaveBeenCalled()
  })

  /** A quote the feed stopped refreshing would bind the signer to a rate the market has
   *  left; the step fails under the component's own copy and the retry asks again. */
  it("does not mint at a quote that has gone stale", async () => {
    const now = new Date(QUOTED_AT.getTime() + MAX_QUOTE_AGE_MS + 1)

    await expect(mintWith({ now })).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
    })

    expect(mint).not.toHaveBeenCalled()
  })

  /** The document states when the rate held, which is when the price service quoted it,
   *  not when the signer happened to open the step minutes later. */
  it("stamps the moment the price service quoted the rate", async () => {
    await mintWith({ now: new Date(QUOTED_AT.getTime() + 5 * 60 * 1000) })

    expect(prefillSent()[AGREEMENT_LABELS.rateTimestamp]).toEqual({
      value: "2026-09-14 16:00",
      locked: true,
    })
  })

  /** Zero is no price at all, so it is refused as one that never answered. */
  it("does not mint at a price of zero", async () => {
    await expect(mintWith({ quote: quoteOf(0) })).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
    })

    expect(mint).not.toHaveBeenCalled()
  })

  it("lets a failed mint through as it is", async () => {
    mint.mockRejectedValue(signingFailure("down"))

    await expect(mintWith()).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
      message: "down",
    })
  })
})

describe("isQuoteFresh", () => {
  const quote = quoteOf(USD_CENTS_PER_BTC)
  const after = (ms: number) => new Date(QUOTED_AT.getTime() + ms)

  it("refuses a quote the network has not answered", () => {
    expect(isQuoteFresh(null, QUOTED_AT)).toBe(false)
  })

  it("takes a quote that just arrived", () => {
    expect(isQuoteFresh(quote, QUOTED_AT)).toBe(true)
  })

  it("takes a quote right at the age limit", () => {
    expect(isQuoteFresh(quote, after(MAX_QUOTE_AGE_MS))).toBe(true)
  })

  it("refuses a quote past the age limit", () => {
    expect(isQuoteFresh(quote, after(MAX_QUOTE_AGE_MS + 1))).toBe(false)
  })

  /** Age runs from when the quote reached the device, so a phone whose clock is off from
   *  the price service's neither ages a fresh quote nor keeps an old one alive. */
  it("measures the age from arrival, not from the service's stamp", () => {
    const quotedLongAgo = { ...quote, quotedAt: new Date("2020-01-01T00:00:00Z") }

    expect(isQuoteFresh(quotedLongAgo, QUOTED_AT)).toBe(true)
  })
})
