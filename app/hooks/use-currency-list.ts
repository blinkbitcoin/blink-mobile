import { useMemo } from "react"

import { createCustodialCurrencyList } from "@app/custodial/adapters/currency"
import { useCurrencyListQuery } from "@app/graphql/generated"
import { createSelfCustodialCurrencyList } from "@app/self-custodial/adapters/currency"
import { useFiatRates } from "@app/self-custodial/providers/fiat-rates"
import {
  mergeCurrencyLists,
  noCurrencyListSource,
  type DisplayCurrencyEntry,
} from "@app/types/currency"
import { AccountType } from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"

/**
 * The currencies a user may pick between, and the metadata every amount is formatted
 * with — symbol and fraction size.
 *
 * A self-custodial account also reads them from the SDK, which is what keeps its own
 * display currency spelled correctly while the Blink backend is unreachable. Without
 * this a cold start with no backend falls back to the US dollar defaults in
 * `useDisplayCurrency`, so a naira balance renders with a dollar sign. The backend's
 * list is merged over it, entry for entry, whenever it is in hand: see
 * `mergeCurrencyLists` for why its entries win.
 *
 * A custodial account reads the backend's list alone: it is the one its own preference
 * was chosen from.
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

  /**
   * Asked even when the SDK has a list, because the backend's entries are the ones that
   * win — see `mergeCurrencyLists`.
   *
   * Cache-first, which is what `useDisplayCurrency` asked with before any of this. The
   * list is public and rarely changes, and this hook runs inside every price conversion
   * and every display-currency consumer: under cache-and-network each of those mounts
   * sent its own request, every time a screen opened.
   */
  const { data, loading } = useCurrencyListQuery({ fetchPolicy: "cache-first" })
  const backendCurrencies = data?.currencyList

  /**
   * Memoised on the underlying arrays and flags rather than on the two source objects,
   * which are built fresh on every render — depending on those made this recompute
   * every time, and the returned list a new array every time. The currency screen keys
   * an effect on that list to seed its filtered rows, so an unstable identity wiped the
   * user's search on the very next render as they typed.
   */
  return useMemo(() => {
    const selfCustodialSource = isSelfCustodial
      ? createSelfCustodialCurrencyList(sdkCurrencies, sdkHasSettled)
      : noCurrencyListSource
    const backendSource = createCustodialCurrencyList(backendCurrencies, loading)
    const currencyList = mergeCurrencyLists(
      backendSource.currencies,
      selfCustodialSource.currencies,
    )

    if (currencyList.length > 0) {
      return { currencyList, loading: false, isUnavailable: false }
    }
    /** Only self-custodial can conclude that nothing is coming: it is the only session
     *  where every source can be known to have finished empty. */
    const isUnavailable =
      isSelfCustodial && selfCustodialSource.hasSettled && backendSource.hasSettled
    return {
      currencyList,
      loading: !backendSource.hasSettled && !isUnavailable,
      isUnavailable,
    }
  }, [isSelfCustodial, sdkCurrencies, sdkHasSettled, backendCurrencies, loading])
}
