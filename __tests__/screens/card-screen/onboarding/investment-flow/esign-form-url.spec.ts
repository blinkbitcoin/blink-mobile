import { buildESignFormUrl } from "@app/screens/card-screen/onboarding/investment-flow/esign-form-url"
import { resolveInvestmentTerms } from "@app/screens/card-screen/onboarding/investment-flow/investment-terms"

const FORM_URL = "https://forms.example.test/agreement"
const terms = resolveInvestmentTerms(25000)

/** DocuSign reads prefilled values off the fragment, so that is where the assertions look:
 *  anything after a `?` would reach the form as an ordinary query parameter. */
const prefillOf = (url: string): URLSearchParams =>
  new URLSearchParams(new URL(url).hash.slice(1))

describe("buildESignFormUrl", () => {
  it("carries every figure the agreement takes from the app", () => {
    const prefill = prefillOf(buildESignFormUrl(FORM_URL, terms))

    expect(prefill.get("total_subscription_usd")).toBe("25000")
    expect(prefill.get("number_of_units")).toBe("25000")
    expect(prefill.get("price_per_unit_usd")).toBe("1")
    expect(prefill.get("pre_money_valuation_usd")).toBe("10000000")
  })

  /** The one that a `?` would pass silently: the values have to sit in the fragment. */
  it("puts the values in the fragment, never in the query string", () => {
    const url = new URL(buildESignFormUrl(FORM_URL, terms))

    expect(url.hash.startsWith("#")).toBe(true)
    expect(url.searchParams.get("total_subscription_usd")).toBeNull()
  })

  it("leaves the form's own address alone", () => {
    const url = new URL(buildESignFormUrl(FORM_URL, terms))

    expect(`${url.origin}${url.pathname}`).toBe(FORM_URL)
  })

  /** A published form can carry parameters of its own; dropping them would change which
   *  form the signer lands on. */
  it("keeps parameters the form url already had", () => {
    const built = buildESignFormUrl(`${FORM_URL}?locale=en&campaign=abc`, terms)
    const url = new URL(built)

    expect(url.searchParams.get("locale")).toBe("en")
    expect(url.searchParams.get("campaign")).toBe("abc")
    expect(prefillOf(built).get("number_of_units")).toBe("25000")
  })

  /** Percent-encoded, not form-encoded: a `+` is never decoded back to a space inside a
   *  fragment, so a value carrying one would arrive corrupted. */
  it("percent-encodes a value that carries a space", () => {
    const built = buildESignFormUrl(FORM_URL, {
      ...terms,
      preMoneyValuationUsd: "10 000 000" as unknown as number,
    })

    expect(built).toContain("pre_money_valuation_usd=10%20000%20000")
    expect(prefillOf(built).get("pre_money_valuation_usd")).toBe("10 000 000")
  })

  it("replaces a fragment the form url already carried", () => {
    const built = buildESignFormUrl(`${FORM_URL}#stale=1`, terms)

    expect(prefillOf(built).get("stale")).toBeNull()
    expect(prefillOf(built).get("number_of_units")).toBe("25000")
  })

  it("escapes what it appends rather than trusting it", () => {
    const prefill = prefillOf(buildESignFormUrl(FORM_URL, { ...terms, totalUsd: 1000.5 }))

    expect(prefill.get("total_subscription_usd")).toBe("1000.5")
  })

  /** Whatever starts serving these terms may answer with more than the agreement has
   *  fields for. An unnamed term has nowhere to land and must not reach the url. */
  it("drops a term the form has no field for", () => {
    const built = buildESignFormUrl(FORM_URL, {
      ...terms,
      referralCode: "ABC",
    } as never)

    expect(built).not.toContain("undefined=")
    expect(built).not.toContain("ABC")
    expect(prefillOf(built).get("number_of_units")).toBe("25000")
  })

  /**
   * A form url that never arrived is already the flow's problem, and the screen reports
   * it; turning it into a malformed one would only trade an empty embed for a crash.
   */
  it("returns an empty form url untouched", () => {
    expect(buildESignFormUrl("", terms)).toBe("")
  })

  it("returns the form url untouched when there are no terms", () => {
    expect(buildESignFormUrl(FORM_URL, null)).toBe(FORM_URL)
  })

  /**
   * The url is remote config, so a typo published there reaches this function. Parsing it
   * would throw during render and take the screen down, where handing it back lets the
   * component report the bad address itself.
   */
  it("hands back an unparseable url instead of throwing", () => {
    expect(buildESignFormUrl("not a url", terms)).toBe("not a url")
  })
})
