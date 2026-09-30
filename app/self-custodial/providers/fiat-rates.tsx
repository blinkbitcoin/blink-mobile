import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AppState } from "react-native"

import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getSelfCustodialFiatCurrencies,
  withSelfCustodialFiatCurrencies,
} from "@app/store/persistent-state/self-custodial-fiat-currencies"
import {
  getSelfCustodialFiatRates,
  withSelfCustodialFiatRates,
  type StoredFiatRates,
} from "@app/store/persistent-state/self-custodial-fiat-rates"
import { type DisplayCurrencyEntry } from "@app/types/currency"
import { rateFreshness, RateFreshness, type FiatRate } from "@app/types/price"

import { listFiatCurrencies, listFiatRates } from "../bridge/fiat"
import { recordErrorOnce } from "../logging"
import { toDisplayCurrencyList } from "../price/currency-mapping"
import { useSelfCustodialWallet } from "./wallet"

/**
 * Keeps the device's copy of the SDK's fiat feed, which is what prices a self-custodial
 * balance when the Blink backend cannot.
 *
 * The SDK's own `CachedFiatService` caches in memory with a TTL, so it answers offline
 * within a session but has nothing after a process launch. Persisting what we read is
 * therefore not belt-and-braces: it is the only thing standing between a cold start with
 * no connectivity and no fiat figure at all.
 *
 * Refresh is deliberately quiet. A failure leaves the last feed in place and is not
 * surfaced — an old rate is the answer to a failed refresh, and the freshness the
 * consumer reads already says how old.
 */

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

type FiatRatesContextValue = {
  rates: readonly FiatRate[]
  /** Unix milliseconds of the read, or null when nothing has ever been stored. */
  fetchedAt: number | null
  freshness: RateFreshness
  /**
   * Whether this provider has finished trying, so a caller can tell "no rate yet" from
   * "no rate, and none is coming". Without it the home balance cannot choose between a
   * skeleton and a sats figure, and would flash from one to the other on every launch.
   *
   * True as soon as a stored feed is in hand, or once a fetch has settled either way.
   */
  hasSettled: boolean
  /** Code, name, symbol and fraction size for every currency the SDK can price. Empty
   *  until one feed has been read on this device. Unlike a rate it does not go stale. */
  currencies: readonly DisplayCurrencyEntry[]
  refresh: () => Promise<void>
}

const EMPTY_RATES: readonly FiatRate[] = Object.freeze([])
const EMPTY_CURRENCIES: readonly DisplayCurrencyEntry[] = Object.freeze([])

const defaultValue: FiatRatesContextValue = {
  rates: EMPTY_RATES,
  fetchedAt: null,
  freshness: RateFreshness.Expired,
  /** No provider above means nobody is fetching, so nothing is pending either. */
  hasSettled: true,
  currencies: EMPTY_CURRENCIES,
  refresh: async () => {},
}

const FiatRatesContext = createContext<FiatRatesContextValue>(defaultValue)

export const useFiatRates = (): FiatRatesContextValue => useContext(FiatRatesContext)

export const SelfCustodialFiatRatesProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { persistentState, updateState } = usePersistentStateContext()
  const { sdk } = useSelfCustodialWallet()

  const stored = getSelfCustodialFiatRates(persistentState)
  const storedCurrencies = getSelfCustodialFiatCurrencies(persistentState)

  /** Advanced on every tick so a feed that crosses a freshness threshold while the user
   *  watches it stops being presented as current, rather than waiting for the next
   *  unrelated render. */
  const [now, setNow] = useState(() => Date.now())

  /** One in flight at a time: the mount, the foreground and the poll can all come due in
   *  the same moment, and the feed is the same for all three. */
  const inFlightRef = useRef<Promise<void> | null>(null)
  const [hasFetchSettled, setHasFetchSettled] = useState(false)

  const persistRates = useCallback(
    (rates: FiatRate[]) => {
      const next: StoredFiatRates = { rates, fetchedAt: Date.now() }
      updateState((prev) => prev && withSelfCustodialFiatRates(prev, next))
      setNow(Date.now())
    },
    [updateState],
  )

  const persistCurrencies = useCallback(
    (currencies: DisplayCurrencyEntry[]) => {
      const next = { currencies, fetchedAt: Date.now() }
      updateState((prev) => prev && withSelfCustodialFiatCurrencies(prev, next))
    },
    [updateState],
  )

  const refresh = useCallback(async () => {
    if (!sdk) return
    if (inFlightRef.current) return inFlightRef.current

    const run = (async () => {
      try {
        /** Settled rather than all-or-nothing: the rates are what the balance needs, and
         *  losing them because the currency list failed would be the worse trade. */
        const [rates, currencies] = await Promise.allSettled([
          listFiatRates(sdk),
          listFiatCurrencies(sdk),
        ])
        if (rates.status === "fulfilled" && rates.value.length > 0) {
          persistRates(rates.value)
        }
        if (currencies.status === "fulfilled") {
          const mapped = toDisplayCurrencyList(currencies.value)
          if (mapped.length > 0) persistCurrencies(mapped)
        }
        const failure = [rates, currencies].find((result) => result.status === "rejected")
        if (failure?.status === "rejected") throw failure.reason
      } catch (err) {
        // Quiet by design: the stored feed stands, and its freshness says how old it is.
        recordErrorOnce(
          "self-custodial-fiat-rates-refresh-failed",
          err instanceof Error ? err : new Error(`Fiat rate refresh failed: ${err}`),
        )
      } finally {
        inFlightRef.current = null
        setHasFetchSettled(true)
      }
    })()

    inFlightRef.current = run
    return run
  }, [sdk, persistRates, persistCurrencies])

  /** On connect, and again whenever the wallet reconnects under a new SDK instance. */
  useEffect(() => {
    if (!sdk) return
    refresh()
  }, [sdk, refresh])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") refresh()
    })
    return () => subscription.remove()
  }, [refresh])

  /** One timer for both jobs: they run at the same cadence, and a tick that refreshes
   *  without re-reading the clock would leave the freshness label behind. */
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
      refresh()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  /** Nothing to wait for when there is no SDK to ask: a caller blocked on `hasSettled`
   *  would otherwise wait forever on a custodial-only device. */
  const hasSettled = hasFetchSettled || !sdk

  const currencies = storedCurrencies?.currencies ?? EMPTY_CURRENCIES

  const value = useMemo<FiatRatesContextValue>(() => {
    if (!stored || stored.rates.length === 0) {
      return {
        rates: EMPTY_RATES,
        fetchedAt: null,
        freshness: RateFreshness.Expired,
        hasSettled,
        currencies,
        refresh,
      }
    }
    return {
      rates: stored.rates,
      fetchedAt: stored.fetchedAt,
      freshness: rateFreshness(stored.fetchedAt, now),
      /** A stored feed is an answer already, whatever a refresh is doing. */
      hasSettled: true,
      currencies,
      refresh,
    }
  }, [stored, now, hasSettled, currencies, refresh])

  return <FiatRatesContext.Provider value={value}>{children}</FiatRatesContext.Provider>
}
