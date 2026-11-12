import { recordAppError } from "@app/utils/error-reporting"

import { WalletCurrency } from "@app/graphql/generated"
import {
  DisplayCurrency,
  MoneyAmount,
  moneyAmountIsCurrencyType,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import {
  firstPricedSource,
  SATS_DISPLAY_CURRENCY,
  type PriceSource,
} from "@app/types/price"

/**
 * How the app turns the price sources into what screens read: which source prices the
 * session, what amounts are shown in, and the converters built on that answer.
 *
 * Pure, so the hook that gathers the sources only has to gather them, and every
 * transition between priced, still waiting and sats only can be stated as inputs.
 */

/** Has units of `inCurrency` per `currency`. */
type PriceOfCurrencyInCurrency = (
  currency: WalletOrDisplayCurrency,
  inCurrency: WalletOrDisplayCurrency,
) => number

type PriceMatrix = Record<
  WalletOrDisplayCurrency,
  Record<WalletOrDisplayCurrency, number>
>

/**
 * The conversion matrix for a wallet nothing can price in fiat, where the display
 * currency *is* sats.
 *
 * Bitcoin and the display currency become the same unit, so those legs are the identity
 * and every screen that asks "this amount, in the display currency" keeps working. The
 * US dollar legs stay unknown, because expressing a held USDB balance in sats needs the
 * very rate that is missing. A `NaN` there renders as an empty string rather than a
 * fabricated number, and the surfaces that hold dollars show them in dollars instead.
 */
const SATS_ONLY_PRICES: PriceMatrix = {
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

export const satsOnlyPriceOfCurrencyInCurrency: PriceOfCurrencyInCurrency = (
  currency,
  inCurrency,
) => SATS_ONLY_PRICES[currency][inCurrency]

/** The matrix for a priced session, or undefined while either rate is missing. Takes the
 *  two rates rather than a `PriceRates` so a caller can memoize on the numbers: the
 *  sources build a new rates object on every render. */
export const priceOfCurrencyInCurrencyFromRates = (
  displayCurrencyPerSat: number,
  displayCurrencyPerCent: number,
): PriceOfCurrencyInCurrency | undefined => {
  if (!displayCurrencyPerSat || !displayCurrencyPerCent) return undefined

  const prices: PriceMatrix = {
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
  return (currency, inCurrency) => prices[currency][inCurrency]
}

type PriceSelection = {
  /** The source whose answer prices the session: the first that could price the display
   *  currency, or the last when none could, so it still says whether anything is trying. */
  source: PriceSource
  /** True while amounts are stated in sats because no rate could be found. */
  isSatsOnly: boolean
  /** What amounts are *shown* in: the preference, or sats while no rate can be found. */
  shownCurrency: string
}

type PriceSelectionInput = {
  isSelfCustodial: boolean
  /** The user's real preference, which the sources were asked to price. */
  displayCurrency: string
  selfCustodialSource: PriceSource
  backendSource: PriceSource
}

export const selectPrice = ({
  isSelfCustodial,
  displayCurrency,
  selfCustodialSource,
  backendSource,
}: PriceSelectionInput): PriceSelection => {
  /**
   * Order is preference: the SDK first for a self-custodial account, because both
   * sources quote the same market and preferring the one that survives an outage keeps
   * an amount on screen from changing meaning as services come and go. A custodial
   * session has only the backend, and `noPriceSource` drops out of the selection.
   *
   * That holds while the feed is stale too. A stale rate is shown unlabelled, the feed
   * is refreshed every five minutes and on every foreground, and expiry hands over to
   * the backend. Asking the backend for a fresher figure meanwhile
   * would move amounts twice in the first seconds of a launch, since a feed stored on
   * one launch is often stale by the next.
   *
   * A third source, such as a cached third-party feed or a terminal's own rate, is an
   * extra argument here rather than an edit to everything below.
   */
  const source = firstPricedSource(selfCustodialSource, backendSource)

  /**
   * No source can price this wallet in fiat, and none is still trying. Rather than
   * leaving every screen without a converter, which is what left the receive screen
   * spinning, the display currency becomes sats and amounts are stated in the unit
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

  return {
    source,
    isSatsOnly,
    shownCurrency: isSatsOnly ? SATS_DISPLAY_CURRENCY : displayCurrency,
  }
}

type PriceConverters = {
  convertMoneyAmount: <T extends WalletOrDisplayCurrency>(
    moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
    toCurrency: T,
  ) => MoneyAmount<T>
  convertMoneyAmountWithRounding: <T extends WalletOrDisplayCurrency>(
    moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
    toCurrency: T,
    roundingFn: (value: number) => number,
  ) => MoneyAmount<T>
}

/**
 * The converters every screen prices amounts with. A display amount tagged with another
 * display currency than `shownCurrency` converts to `NaN` and is reported, rather than
 * being read as though the two currencies were the same money.
 */
export const createPriceConverters = (
  priceOfCurrencyInCurrency: PriceOfCurrencyInCurrency,
  shownCurrency: string,
): PriceConverters => {
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

  return { convertMoneyAmount, convertMoneyAmountWithRounding: convertWithRounding }
}
