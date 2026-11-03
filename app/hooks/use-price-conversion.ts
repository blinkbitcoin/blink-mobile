import { useMemo } from "react"

import {
  useRealtimePriceQuery,
  useRealtimePriceUnauthedQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { createCustodialPriceSource } from "@app/custodial/adapters/price"
import { createSelfCustodialPriceSource } from "@app/self-custodial/adapters/price"
import { useFiatRates } from "@app/self-custodial/providers/fiat-rates"
import { noPriceSource, RateFreshness, type PriceSource } from "@app/types/price"
import { createToDisplayAmount } from "@app/types/amounts"
import { AccountType } from "@app/types/wallet"
import {
  createPriceConverters,
  priceOfCurrencyInCurrencyFromRates,
  satsOnlyPriceOfCurrencyInCurrency,
  selectPrice,
} from "@app/utils/price-conversion"

import { useAccountRegistry } from "./use-account-registry"
import { useCurrencyList } from "./use-currency-list"
import { useEffectiveDisplayCurrency } from "./use-effective-display-currency"

export const SATS_PER_BTC = 100000000

export const PriceStatus = {
  /** A conversion is available. */
  Ready: "ready",
  /** None yet, but a source may still answer — the first frames of a launch or an
   *  account switch. Callers should wait rather than show a figure. */
  Pending: "pending",
  /** None, and none is coming. Callers must show something other than a spinner. */
  Unavailable: "unavailable",
} as const

export type PriceStatus = (typeof PriceStatus)[keyof typeof PriceStatus]

const PRICE_POLL_INTERVAL_MS = 5 * 60 * 1000

/**
 * Whether a caller waiting on a conversion should keep waiting. Only self-custodial can
 * reach Unavailable: it is the only session where every source can be known to have
 * finished and come back empty, which is exactly when it falls back to sats. A custodial
 * session keeps today's behaviour, where no price means the screen is still loading.
 */
const priceStatusOf = (source: PriceSource, isSatsOnly: boolean): PriceStatus => {
  /** A converter exists, but there is no fiat price. Callers keyed on this, like the
   *  balance header's own sats fallback, must not behave as though a rate had arrived. */
  if (isSatsOnly) return PriceStatus.Unavailable
  if (source.rates) return PriceStatus.Ready
  return PriceStatus.Pending
}

const finiteOrNull = (btcInUsdCents: number | undefined): string | null =>
  btcInUsdCents === undefined || !Number.isFinite(btcInUsdCents)
    ? null
    : (btcInUsdCents / 100).toFixed(8)

export const usePriceConversion = () => {
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  const { displayCurrency } = useEffectiveDisplayCurrency()

  /**
   * The SDK's feed, which a self-custodial account can read without the Blink backend.
   * Only built for such an account: a second wallet on the device may have fetched a
   * feed, but it is not this session's price.
   */
  const feed = useFiatRates()

  /**
   * Breez quotes whole units and the app works in minor ones, so the display currency's
   * fraction size is what makes its rates comparable with the backend's. Taken from the
   * resolved list rather than the SDK's own: that is the size every amount is formatted
   * with, and it is the backend's wherever the backend lists the currency, which is the
   * only size its own rate is right under. A whole-unit rate scales to either.
   */
  const { currencyList } = useCurrencyList()
  const fractionDigits = currencyList.find(
    (currency) => currency.id.toUpperCase() === displayCurrency.toUpperCase(),
  )?.fractionDigits

  const selfCustodialSource: PriceSource = isSelfCustodial
    ? createSelfCustodialPriceSource(feed, displayCurrency, fractionDigits)
    : noPriceSource

  const skipAuthed = !isAuthed || isSelfCustodial
  const { data: authedData } = useRealtimePriceQuery({
    skip: skipAuthed,
    fetchPolicy: "cache-and-network",
  })
  const authedPrice = authedData?.me?.defaultAccount?.realtimePrice

  /**
   * Self-custodial keeps asking only while the SDK has not priced the display currency,
   * which is the feed's own gap rather than an outage — an exotic code the SDK does not
   * carry but the backend does. Once the SDK answers, the backend is not asked at all,
   * so a self-custodial session makes no price request of its own.
   */
  const skipUnauthed = isSelfCustodial
    ? Boolean(selfCustodialSource.rates)
    : isAuthed || Boolean(authedPrice)
  const { data: unauthedData, loading: unauthedLoading } = useRealtimePriceUnauthedQuery({
    skip: skipUnauthed,
    variables: { currency: displayCurrency },
    pollInterval: skipUnauthed ? undefined : PRICE_POLL_INTERVAL_MS,
    fetchPolicy: "cache-and-network",
  })

  const backendSource = createCustodialPriceSource(
    isSelfCustodial
      ? unauthedData?.realtimePrice
      : authedPrice ?? unauthedData?.realtimePrice,
    displayCurrency,
    !unauthedLoading,
  )

  const { source, isSatsOnly, shownCurrency } = selectPrice({
    isSelfCustodial,
    displayCurrency,
    selfCustodialSource,
    backendSource,
  })

  /** Memoized on the numbers rather than on `source`: the sources build a new rates
   *  object on every render, and a new converter makes every screen holding one rebuild
   *  what it priced. */
  const displayCurrencyPerSat = source.rates?.displayCurrencyPerSat ?? NaN
  const displayCurrencyPerCent = source.rates?.displayCurrencyPerCent ?? NaN

  const priceOfCurrencyInCurrency = useMemo(
    () =>
      isSatsOnly
        ? satsOnlyPriceOfCurrencyInCurrency
        : priceOfCurrencyInCurrencyFromRates(
            displayCurrencyPerSat,
            displayCurrencyPerCent,
          ),
    [displayCurrencyPerSat, displayCurrencyPerCent, isSatsOnly],
  )

  const converters = useMemo(
    () =>
      priceOfCurrencyInCurrency
        ? createPriceConverters(priceOfCurrencyInCurrency, shownCurrency)
        : undefined,
    [priceOfCurrencyInCurrency, shownCurrency],
  )

  /**
   * How current the rate behind these amounts is, as the source that answered reports
   * it. Only the SDK feed can be old enough to matter; the backend has no persisted
   * copy to inherit, so anything priced off it reads Fresh.
   */
  const priceFreshness: RateFreshness = source.freshness

  const priceStatus = priceStatusOf(source, isSatsOnly)

  return {
    convertMoneyAmount: converters?.convertMoneyAmount,
    /** Ready, Pending or Unavailable — see {@link PriceStatus}. A caller that today
     *  renders a spinner on a missing `convertMoneyAmount` should render something
     *  else on Unavailable, or it spins forever. */
    priceStatus,
    convertMoneyAmountWithRounding: converters?.convertMoneyAmountWithRounding,
    displayCurrency: shownCurrency,
    /** True while amounts are stated in sats because no rate could be found. Surfaces
     *  that show money read this to tell the user why, rather than letting a balance
     *  silently change denomination. */
    isSatsOnly,
    toDisplayMoneyAmount: createToDisplayAmount(shownCurrency),
    /** Fresh, Stale or Expired. Expired means no conversion is available at all, which
     *  `convertMoneyAmount` being undefined already says; Stale means the amounts are
     *  real but priced off a rate old enough that the user should be told. */
    priceFreshness,
    /** Null rather than the string "NaN" when the dollar leg is unknown, which is the
     *  case in sats-only mode: a caller checking for a price must not be handed one. */
    usdPerSat: finiteOrNull(
      priceOfCurrencyInCurrency?.(WalletCurrency.Btc, WalletCurrency.Usd),
    ),
  }
}
