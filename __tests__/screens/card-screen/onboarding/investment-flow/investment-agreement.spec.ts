import {
  AGREEMENT_LABELS,
  mintInvestmentAgreement,
  signingFailure,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-agreement"

/** A round rate, so every figure below can be checked by hand: one bitcoin at $100,000,
 *  in the cents the price feed is read in, so $25,000 buys a quarter of a bitcoin. */
const USD_CENTS_PER_BTC = 10_000_000
const QUOTED_AT = new Date("2026-09-14T22:00:00Z")
const TOTAL_USD = 25000

const MINTED = { url: "https://sign.example.test/envelope/1", envelopeId: "envelope-1" }

/** The call to the service, which is the one thing this module does not do itself. */
const mint = jest.fn()

const mintWith = (
  overrides: Partial<Parameters<typeof mintInvestmentAgreement>[0]> = {},
) =>
  mintInvestmentAgreement({
    totalUsd: TOTAL_USD,
    usdCentsPerBtc: USD_CENTS_PER_BTC,
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
    await mintWith({ usdCentsPerBtc: 6_712_345 })

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
      usdCentsPerBtc: 7_000_000,
    })

    expect(Number.isInteger(settlementSats)).toBe(true)
    expect(settlementSats).toBe(1_428_571)
  })

  /** The agreement fixes a rate the payment is then owed at, so a guessed one would be
   *  worse than none: the step fails under the component's own copy and the retry reads
   *  the price again. */
  it("does not mint before the price feed has answered", async () => {
    await expect(mintWith({ usdCentsPerBtc: null })).rejects.toMatchObject({
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
