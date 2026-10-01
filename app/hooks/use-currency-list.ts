import { useMemo } from "react"

import { createCustodialCurrencyList } from "@app/custodial/adapters/currency"
import { useCurrencyListQuery } from "@app/graphql/generated"
import { createSelfCustodialCurrencyList } from "@app/self-custodial/adapters/currency"
import { useFiatRates } from "@app/self-custodial/providers/fiat-rates"
import {
  firstPopulatedCurrencyList,
  noCurrencyListSource,
  withPreferredNames,
  type DisplayCurrencyEntry,
} from "@app/types/currency"
import { AccountType } from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"

/**
 * The currencies a user may pick between, and the metadata every amount is formatted
 * with — symbol and fraction size.
 *
 * A self-custodial account reads them from the SDK, which is what keeps its own display
 * currency spelled correctly while the Blink backend is unreachable. Without this a
 * cold start with no backend falls back to the US dollar defaults in
 * `useDisplayCurrency`, so a naira balance renders with a dollar sign.
 *
 * The backend is still asked when the SDK has served nothing yet, and for a custodial
 * account always: its list is the one its own preference was chosen from.
 */
export type CurrencyListResult = {
  currencyList: readonly DisplayCurrencyEntry[]
  /** True only while the source that will answer has not. A self-custodial account with
   *  a stored list is never loading, whatever a refresh is doing. */
  loading: boolean
  /** Nothing to show and nothing coming — the picker should say so rather than spin. */
  isUnavailable: boolean
}

export const useCurrencyList = (): CurrencyListResult => {
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  const { currencies: sdkCurrencies, hasSettled: sdkHasSettled } = useFiatRates()

  const selfCustodialSource = isSelfCustodial
    ? createSelfCustodialCurrencyList(sdkCurrencies, sdkHasSettled)
    : noCurrencyListSource

  /**
   * Asked even when the SDK has a list, because the backend is the authority on the
   * *wording* — see `withPreferredNames`. It is a public, rarely-changing query served
   * from the Apollo cache after the first hit, and `useDisplayCurrency` fetched it
   * unconditionally before any of this, so this is not new traffic so much as traffic
   * an earlier pass had removed.
   */
  const { data, loading } = useCurrencyListQuery({ fetchPolicy: "cache-and-network" })
  const backendSource = createCustodialCurrencyList(data?.currencyList, loading)

  return useMemo(() => {
    const source = firstPopulatedCurrencyList(selfCustodialSource, backendSource)
    if (source.currencies.length > 0) {
      return {
        currencyList: withPreferredNames(source.currencies, backendSource.currencies),
        loading: false,
        isUnavailable: false,
      }
    }
    /** Only self-custodial can conclude that nothing is coming: it is the only session
     *  where every source can be known to have finished empty. */
    const isUnavailable =
      isSelfCustodial && selfCustodialSource.hasSettled && backendSource.hasSettled
    return {
      currencyList: source.currencies,
      loading: !source.hasSettled && !isUnavailable,
      isUnavailable,
    }
  }, [selfCustodialSource, backendSource, isSelfCustodial])
}
