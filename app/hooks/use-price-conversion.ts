import { useMemo } from "react"

import { recordAppError } from "@app/utils/error-reporting"

import {
  useRealtimePriceQuery,
  useRealtimePriceUnauthedQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { createCustodialPriceSource } from "@app/custodial/adapters/price"
import { createSelfCustodialPriceSource } from "@app/self-custodial/adapters/price"
import { useFiatRates } from "@app/self-custodial/providers/fiat-rates"
import {
  firstPricedSource,
  noPriceSource,
  RateFreshness,
  SATS_DISPLAY_CURRENCY,
  type PriceSource,
} from "@app/types/price"
import {
  createToDisplayAmount,
  DisplayCurrency,
  MoneyAmount,
  moneyAmountIsCurrencyType,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { AccountType } from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"
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

/**
 * The conversion matrix for a wallet nothing can price in fiat, where the display
 * currency *is* sats.
 *
 * Bitcoin and the display currency become the same unit, so those legs are the identity
 * and every screen that asks "this amount, in the display currency" keeps working. The
 * US dollar legs stay unknown, because expressing a held USDB balance in sats needs the
 * very rate that is missing — a `NaN` there renders as an empty string rather than a
 * fabricated number, and the surfaces that hold dollars show them in dollars instead.
 */
const SATS_ONLY_PRICES: Record<
  WalletOrDisplayCurrency,
  Record<WalletOrDisplayCurrency, number>
> = {
  [WalletCurrency.Btc]: {
    [DisplayCurrency]: 1,
    [WalletCurrency.Usd]: Number.NaN,
    [WalletCurrency.Btc]: 1,
  },
  [WalletCurrency.Usd]: {
    [DisplayCurrency]: Number.NaN,
    [WalletCurrency.Btc]: Number.NaN,
    [WalletCurrency.Usd]: 1,
  },
  [DisplayCurrency]: {
    [WalletCurrency.Btc]: 1,
    [WalletCurrency.Usd]: Number.NaN,
    [DisplayCurrency]: 1,
  },
}

const PRICE_POLL_INTERVAL_MS = 5 * 60 * 1000

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
  const selfCustodialSource: PriceSource = isSelfCustodial
    ? createSelfCustodialPriceSource(feed, displayCurrency)
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

  /**
   * Order is preference: the SDK first for a self-custodial account, because both
   * sources quote the same market and preferring the one that survives an outage keeps
   * an amount on screen from changing meaning as services come and go. A custodial
   * session has only the backend, and `noPriceSource` drops out of the selection.
   *
   * A third source — a cached third-party feed, a terminal's own rate — is an extra
   * argument here rather than an edit to everything below.
   */
  const source = firstPricedSource(selfCustodialSource, backendSource)

  /**
   * No source can price this wallet in fiat, and none is still trying. Rather than
   * leaving every screen without a converter — which is what left the receive screen
   * spinning — the display currency becomes sats and amounts are stated in the unit
   * their own wallet is denominated in.
   *
   * Self-custodial only, because it is the only session where every source can be known
   * to have finished empty. A custodial session keeps waiting, as it always has.
   */
  const isSatsOnly =
    isSelfCustodial &&
    source.rates === undefined &&
    selfCustodialSource.hasSettled &&
    backendSource.hasSettled

  /** What amounts are *shown* in. The real preference still drives the queries above and
   *  the feed lookup, so turning the rate back on restores the user's own currency. */
  const shownCurrency = isSatsOnly ? SATS_DISPLAY_CURRENCY : displayCurrency

  const displayCurrencyPerSat = source.rates?.displayCurrencyPerSat ?? NaN
  const displayCurrencyPerCent = source.rates?.displayCurrencyPerCent ?? NaN

  const priceOfCurrencyInCurrency = useMemo(() => {
    if (isSatsOnly) {
      return (currency: WalletOrDisplayCurrency, inCurrency: WalletOrDisplayCurrency) =>
        SATS_ONLY_PRICES[currency][inCurrency]
    }

    if (!displayCurrencyPerSat || !displayCurrencyPerCent) {
      return undefined
    }

    // has units of denomiatedInCurrency/currency
    return (
      currency: WalletOrDisplayCurrency,
      inCurrency: WalletOrDisplayCurrency,
    ): number => {
      const priceOfCurrencyInCurrency = {
        [WalletCurrency.Btc]: {
          [DisplayCurrency]: displayCurrencyPerSat,
          [WalletCurrency.Usd]: displayCurrencyPerSat * (1 / displayCurrencyPerCent),
          [WalletCurrency.Btc]: 1,
        },
        [WalletCurrency.Usd]: {
          [DisplayCurrency]: displayCurrencyPerCent,
          [WalletCurrency.Btc]: displayCurrencyPerCent * (1 / displayCurrencyPerSat),
          [WalletCurrency.Usd]: 1,
        },
        [DisplayCurrency]: {
          [WalletCurrency.Btc]: 1 / displayCurrencyPerSat,
          [WalletCurrency.Usd]: 1 / displayCurrencyPerCent,
          [DisplayCurrency]: 1,
        },
      }
      return priceOfCurrencyInCurrency[currency][inCurrency]
    }
  }, [displayCurrencyPerSat, displayCurrencyPerCent, isSatsOnly])

  const converters = useMemo(() => {
    if (!priceOfCurrencyInCurrency) {
      return undefined
    }

    const convertWithRounding = <T extends WalletOrDisplayCurrency>(
      moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
      toCurrency: T,
      roundingFn: (value: number) => number,
    ): MoneyAmount<T> => {
      // If the money amount is already the correct currency, return it
      if (moneyAmountIsCurrencyType(moneyAmount, toCurrency)) {
        return moneyAmount
      }

      let amount = roundingFn(
        moneyAmount.amount * priceOfCurrencyInCurrency(moneyAmount.currency, toCurrency),
      )

      if (
        moneyAmountIsCurrencyType(moneyAmount, DisplayCurrency) &&
        moneyAmount.currencyCode !== shownCurrency
      ) {
        amount = NaN

        recordAppError(
          new Error(
            `Price conversion is out of sync with display currency. Money amount: ${moneyAmount.currencyCode}, display currency: ${shownCurrency}`,
          ),
        )
      }

      return {
        amount,
        currency: toCurrency,
        currencyCode: toCurrency === DisplayCurrency ? shownCurrency : toCurrency,
      }
    }

    const convertMoneyAmount = <T extends WalletOrDisplayCurrency>(
      moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
      toCurrency: T,
    ): MoneyAmount<T> => convertWithRounding(moneyAmount, toCurrency, Math.round)

    const convertMoneyAmountWithRounding = <T extends WalletOrDisplayCurrency>(
      moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
      toCurrency: T,
      roundingFn: (value: number) => number,
    ): MoneyAmount<T> => convertWithRounding(moneyAmount, toCurrency, roundingFn)

    return { convertMoneyAmount, convertMoneyAmountWithRounding }
  }, [priceOfCurrencyInCurrency, shownCurrency])

  /**
   * How current the rate behind these amounts is, as the source that answered reports
   * it. Only the SDK feed can be old enough to matter; the backend has no persisted
   * copy to inherit, so anything priced off it reads Fresh.
   */
  const priceFreshness: RateFreshness = source.freshness

  /**
   * Whether a caller waiting on a conversion should keep waiting. Only self-custodial
   * can reach Unavailable: it is the only session where every source can be known to
   * have finished and come back empty. A custodial session keeps today's behaviour,
   * where no price means the screen is still loading.
   */
  const priceStatus: PriceStatus = isSatsOnly
    ? /** A converter exists, but there is no fiat price. Callers keyed on this — the
       *  balance header's own sats fallback — must not start behaving as though a rate
       *  had arrived. */
      PriceStatus.Unavailable
    : converters
      ? PriceStatus.Ready
      : isSelfCustodial && selfCustodialSource.hasSettled && backendSource.hasSettled
        ? PriceStatus.Unavailable
        : PriceStatus.Pending

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
