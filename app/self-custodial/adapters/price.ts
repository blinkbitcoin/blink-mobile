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
 *
 * Pricing also needs the display currency's fraction size, because Breez quotes whole
 * units and the app works in minor ones. It is passed in rather than read from the SDK's
 * own currency list so that either list can supply it — the two are fetched separately
 * and one can fail alone, and a device with rates but no metadata would otherwise lose
 * pricing it could have had. `undefined` prices nothing rather than being guessed at two
 * decimals: that guess is wrong for yen, won and franc CFA, and wrong by a hundredfold.
 */
export const createSelfCustodialPriceSource = (
  feed: SelfCustodialFeed,
  displayCurrency: string,
  fractionDigits: number | undefined,
): PriceSource => ({
  rates:
    feed.freshness === RateFreshness.Expired || fractionDigits === undefined
      ? undefined
      : toPriceRates(feed.rates, displayCurrency, fractionDigits),
  freshness: feed.freshness,
  hasSettled: feed.hasSettled,
})
