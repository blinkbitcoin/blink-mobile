import { useMemo } from "react"

import { useCurrencyListQuery } from "@app/graphql/generated"
import { type DisplayCurrencyEntry } from "@app/self-custodial/price/currency-mapping"
import { useFiatRates } from "@app/self-custodial/providers/fiat-rates"
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

const EMPTY: readonly DisplayCurrencyEntry[] = Object.freeze([])

export const useCurrencyList = (): CurrencyListResult => {
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  const { currencies: sdkCurrencies, hasSettled: sdkHasSettled } = useFiatRates()

  const hasSdkList = isSelfCustodial && sdkCurrencies.length > 0

  const { data, loading } = useCurrencyListQuery({
    skip: hasSdkList,
    fetchPolicy: "cache-and-network",
  })

  return useMemo(() => {
    if (hasSdkList) {
      return { currencyList: sdkCurrencies, loading: false, isUnavailable: false }
    }
    const backendList = data?.currencyList ?? EMPTY
    if (backendList.length > 0) {
      return { currencyList: backendList, loading: false, isUnavailable: false }
    }
    /** Only self-custodial can conclude that nothing is coming: it is the only session
     *  whose other source can be known to have finished empty. */
    const isUnavailable = !loading && isSelfCustodial && sdkHasSettled
    return { currencyList: EMPTY, loading: loading && !isUnavailable, isUnavailable }
  }, [
    hasSdkList,
    sdkCurrencies,
    data?.currencyList,
    loading,
    isSelfCustodial,
    sdkHasSettled,
  ])
}
