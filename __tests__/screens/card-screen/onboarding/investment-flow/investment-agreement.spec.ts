import {
  AGREEMENT_LABELS,
  mintInvestmentAgreement,
  signingFailure,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-agreement"

/** A round rate, so every figure below can be checked by hand: $100,000 per bitcoin is
 *  $0.001 per satoshi, and $25,000 buys a quarter of a bitcoin. */
/** One bitcoin at $100,000, in the cents the price feed is read in. */
const USD_CENTS_PER_BTC = 10_000_000
const QUOTED_AT = new Date("2026-09-14T22:00:00Z")
const TOTAL_USD = 25000

/** Synthetic host fields in the shape remote config carries them; nothing here is anyone's
 *  data. */
const HOST_COUNTRY_LABEL = "country_of_residence"

const HOST_FIELDS = {
  [AGREEMENT_LABELS.signerName]: "Test Signer",
  [AGREEMENT_LABELS.signerEmail]: "signer@example.test",
  [HOST_COUNTRY_LABEL]: "Testland",
}

const MINTED = { url: "https://sign.example.test/envelope/1", envelopeId: "envelope-1" }

/** The call to the service, which is the one thing this module does not do itself. */
const mint = jest.fn()

const mintWith = (
  overrides: Partial<Parameters<typeof mintInvestmentAgreement>[0]> = {},
) =>
  mintInvestmentAgreement({
    totalUsd: TOTAL_USD,
    usdCentsPerBtc: USD_CENTS_PER_BTC,
    fields: HOST_FIELDS,
    mint,
    now: QUOTED_AT,
    ...overrides,
  })

/** What the document was written with on the one call made. */
const prefillSent = () =>
  mint.mock.calls[0][1] as Record<string, { value: string; locked: true }>

describe("mintInvestmentAgreement", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mint.mockResolvedValue(MINTED)
  })

  it("hands back what the service minted", async () => {
    await expect(mintWith()).resolves.toMatchObject({ minted: MINTED })
  })

  it("names the signer from the host's fields", async () => {
    await mintWith()

    expect(mint).toHaveBeenCalledWith(
      { name: "Test Signer", email: "signer@example.test" },
      expect.any(Object),
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

  /** Which fields the host fills in is remote config's to decide: a field added to a
   *  template needs no release, the module locks whatever it is handed. */
  it("relays every host field, locked", async () => {
    await mintWith()

    expect(prefillSent()).toMatchObject({
      [AGREEMENT_LABELS.signerName]: { value: "Test Signer", locked: true },
      [AGREEMENT_LABELS.signerEmail]: { value: "signer@example.test", locked: true },
      [HOST_COUNTRY_LABEL]: { value: "Testland", locked: true },
    })
  })

  /** Remote config is JSON, so a host may well type a number where the document takes
   *  text; the service refuses anything but a string. */
  it("writes a host value as text whatever the host typed", async () => {
    await mintWith({
      fields: { ...HOST_FIELDS, [HOST_COUNTRY_LABEL]: 504 as unknown as string },
    })

    expect(prefillSent()[HOST_COUNTRY_LABEL]).toEqual({ value: "504", locked: true })
  })

  /** The figures are computed from the amount the investor chose; a host field carrying
   *  one of their labels must not put another number on the document. */
  it("keeps the computed figures over a host field of the same label", async () => {
    await mintWith({ fields: { ...HOST_FIELDS, [AGREEMENT_LABELS.totalUsd]: "1.00" } })

    expect(prefillSent()[AGREEMENT_LABELS.totalUsd]).toEqual({
      value: "25000.00",
      locked: true,
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

  /** An envelope cannot be addressed to nobody, and a placeholder would put a made-up
   *  name on a legal document. It fails under its own code, which the step words in the
   *  signer's language, so whoever fills the host's fields reads what is missing. */
  it("does not mint while the host has not named the signer in full", async () => {
    const refused = {
      code: "SIGNER_NOT_CONFIGURED",
      message: expect.stringContaining("signer"),
    }

    await expect(
      mintWith({ fields: { [AGREEMENT_LABELS.signerName]: "Test Signer" } }),
    ).rejects.toMatchObject(refused)
    await expect(
      mintWith({ fields: { [AGREEMENT_LABELS.signerEmail]: "signer@example.test" } }),
    ).rejects.toMatchObject(refused)
    await expect(mintWith({ fields: {} })).rejects.toMatchObject(refused)

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
