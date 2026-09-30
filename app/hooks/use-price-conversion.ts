import { useMemo } from "react"

import { recordAppError } from "@app/utils/error-reporting"

import {
  useRealtimePriceQuery,
  useRealtimePriceUnauthedQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { toPriceRatesFromRealtimePrice } from "@app/custodial/adapters/price"
import { toPriceRates } from "@app/self-custodial/price/rate-mapping"
import { useFiatRates } from "@app/self-custodial/providers/fiat-rates"
import { RateFreshness, type PriceRates } from "@app/types/price"
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

const PRICE_POLL_INTERVAL_MS = 5 * 60 * 1000

export const usePriceConversion = () => {
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  const { displayCurrency } = useEffectiveDisplayCurrency()

  /**
   * The SDK's feed, which a self-custodial account can read without the Blink backend.
   * Empty outside a self-custodial session, and expired when it is too old to present.
   */
  const {
    rates: sdkRates,
    freshness: sdkFreshness,
    hasSettled: sdkHasSettled,
  } = useFiatRates()
  const sdkPriceRates =
    isSelfCustodial && sdkFreshness !== RateFreshness.Expired
      ? toPriceRates(sdkRates, displayCurrency)
      : undefined

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
    ? Boolean(sdkPriceRates)
    : isAuthed || Boolean(authedPrice)
  const { data: unauthedData, loading: unauthedLoading } = useRealtimePriceUnauthedQuery({
    skip: skipUnauthed,
    variables: { currency: displayCurrency },
    pollInterval: skipUnauthed ? undefined : PRICE_POLL_INTERVAL_MS,
    fetchPolicy: "cache-and-network",
  })

  const candidatePrice = isSelfCustodial
    ? unauthedData?.realtimePrice
    : authedPrice ?? unauthedData?.realtimePrice

  // Discard cached price when its denominator disagrees with the active preference.
  const realtimePrice =
    candidatePrice?.denominatorCurrency === displayCurrency ? candidatePrice : undefined

  const backendPriceRates: PriceRates | undefined = realtimePrice
    ? toPriceRatesFromRealtimePrice(realtimePrice)
    : undefined

  /**
   * The SDK first for a self-custodial account. Both sources quote the same market, and
   * preferring the one that is still there when the backend is not keeps the amounts on
   * screen from changing meaning as services come and go.
   */
  const priceRates = sdkPriceRates ?? backendPriceRates

  const displayCurrencyPerSat = priceRates?.displayCurrencyPerSat ?? NaN
  const displayCurrencyPerCent = priceRates?.displayCurrencyPerCent ?? NaN

  const priceOfCurrencyInCurrency = useMemo(() => {
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
  }, [displayCurrencyPerSat, displayCurrencyPerCent])

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
        moneyAmount.currencyCode !== displayCurrency
      ) {
        amount = NaN

        recordAppError(
          new Error(
            `Price conversion is out of sync with display currency. Money amount: ${moneyAmount.currencyCode}, display currency: ${displayCurrency}`,
          ),
        )
      }

      return {
        amount,
        currency: toCurrency,
        currencyCode: toCurrency === DisplayCurrency ? displayCurrency : toCurrency,
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
  }, [priceOfCurrencyInCurrency, displayCurrency])

  /**
   * How current the rate behind these amounts is. Only the SDK feed can be old enough to
   * matter: the backend's price is refetched per session and has no cached-but-ancient
   * state to inherit, so anything priced off it reads Fresh.
   */
  const priceFreshness: RateFreshness = sdkPriceRates
    ? sdkFreshness
    : backendPriceRates
      ? RateFreshness.Fresh
      : RateFreshness.Expired

  /**
   * Whether a caller waiting on a conversion should keep waiting. Only self-custodial
   * can reach Unavailable: it is the only session whose price source can be known to
   * have finished and come back empty. A custodial session keeps today's behaviour,
   * where no price means the screen is still loading.
   */
  const priceStatus: PriceStatus = converters
    ? PriceStatus.Ready
    : isSelfCustodial && sdkHasSettled && !unauthedLoading
      ? PriceStatus.Unavailable
      : PriceStatus.Pending

  return {
    convertMoneyAmount: converters?.convertMoneyAmount,
    /** Ready, Pending or Unavailable — see {@link PriceStatus}. A caller that today
     *  renders a spinner on a missing `convertMoneyAmount` should render something
     *  else on Unavailable, or it spins forever. */
    priceStatus,
    convertMoneyAmountWithRounding: converters?.convertMoneyAmountWithRounding,
    displayCurrency,
    toDisplayMoneyAmount: createToDisplayAmount(displayCurrency),
    /** Fresh, Stale or Expired. Expired means no conversion is available at all, which
     *  `convertMoneyAmount` being undefined already says; Stale means the amounts are
     *  real but priced off a rate old enough that the user should be told. */
    priceFreshness,
    usdPerSat: priceOfCurrencyInCurrency
      ? (priceOfCurrencyInCurrency(WalletCurrency.Btc, WalletCurrency.Usd) / 100).toFixed(
          8,
        )
      : null,
  }
}
