import { RateFreshness, type FiatRate, type PriceSource } from "@app/types/price"

import { toPriceRates } from "../price/rate-mapping"

export type SelfCustodialFeed = {
  rates: readonly FiatRate[]
  freshness: RateFreshness
  hasSettled: boolean
}

/**
 * A {@link PriceSource} over the Breez SDK's fiat feed and the copy this device
 * persisted from it — the source that is still there when the Blink backend is not.
 *
 * An expired feed prices nothing rather than pricing badly: a day-old rate presented as
 * today's is worse than no figure at all, and the caller falls back to sats. It still
 * reports `hasSettled`, so "too old to use" stays distinguishable from "still loading".
 */
export const createSelfCustodialPriceSource = (
  feed: SelfCustodialFeed,
  displayCurrency: string,
): PriceSource => ({
  rates:
    feed.freshness === RateFreshness.Expired
      ? undefined
      : toPriceRates(feed.rates, displayCurrency),
  freshness: feed.freshness,
  hasSettled: feed.hasSettled,
})
