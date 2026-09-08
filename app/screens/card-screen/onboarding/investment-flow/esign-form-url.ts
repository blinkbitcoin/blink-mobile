import type { InvestmentTerms } from "./investment-terms"

/**
 * The published web form asks for both halves of the agreement: who the subscriber is,
 * which only they can answer, and what they are buying, which the app already knows from
 * the amount they picked. Asking again for the second half would let the document say
 * something the user never chose, so those answers ride in on the URL instead.
 *
 * Each key is the field's API reference name in DocuSign, which is the data label its
 * template gives it. A term with nothing to say is left out rather than sent empty.
 */
const FORM_PARAM_BY_TERM = {
  totalUsd: "total_subscription_usd",
  units: "number_of_units",
  pricePerUnitUsd: "price_per_unit_usd",
  preMoneyValuationUsd: "pre_money_valuation_usd",
  btcUsdRate: "btc_usd_rate",
  settlementBtc: "settlement_amount_btc",
  rateTimestamp: "rate_timestamp",
} as const satisfies Record<keyof InvestmentTerms, string>

/**
 * DocuSign reads prefilled values off the FRAGMENT, not the query string: a `?` here
 * reaches the form as an ordinary query parameter and prefills nothing.
 *
 * Hands the form url back untouched whenever it cannot be improved: nothing to prefill, or
 * an address that will not parse. The url is remote config, so a typo published there
 * would otherwise throw during render and take the screen down, where leaving it alone
 * lets the component show its own failure instead.
 */
export const buildESignFormUrl = (
  formUrl: string,
  terms: InvestmentTerms | null,
): string => {
  if (!formUrl || !terms) return formUrl

  try {
    const url = new URL(formUrl)
    /** Percent-encoded rather than form-encoded: a space has to arrive as %20, and
     *  URLSearchParams would send the `+` a fragment never decodes back. */
    const prefill = Object.entries(terms)
      .map(([term, value]) => ({
        param: FORM_PARAM_BY_TERM[term as keyof InvestmentTerms],
        value,
      }))
      /** A term the map does not name has no field to land in, and would otherwise reach
       *  the agreement's url as `undefined=…`. */
      .filter(({ param, value }) => param !== undefined && value !== undefined)
      .map(({ param, value }) => `${param}=${encodeURIComponent(String(value))}`)
      .join("&")

    if (!prefill) return formUrl

    url.hash = ""
    return `${url.toString()}#${prefill}`
  } catch {
    return formUrl
  }
}
