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
  getSelfCustodialFiatRates,
  withSelfCustodialFiatRates,
} from "@app/store/persistent-state/self-custodial-fiat-rates"

import { listFiatRates } from "../bridge/fiat"
import { recordErrorOnce } from "../logging"
import {
  rateFreshness,
  RateFreshness,
  type FiatRate,
  type StoredFiatRates,
} from "../price/rate-mapping"
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
  refresh: () => Promise<void>
}

const EMPTY_RATES: readonly FiatRate[] = Object.freeze([])

const defaultValue: FiatRatesContextValue = {
  rates: EMPTY_RATES,
  fetchedAt: null,
  freshness: RateFreshness.Expired,
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

  /** Re-read on every tick so a feed that crosses a threshold while the user watches it
   *  stops being presented as current, rather than waiting for the next render. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  /** One in flight at a time: the mount, the foreground and the poll can all come due in
   *  the same moment, and the feed is the same for all three. */
  const inFlightRef = useRef<Promise<void> | null>(null)

  const persist = useCallback(
    (rates: FiatRate[]) => {
      const next: StoredFiatRates = { rates, fetchedAt: Date.now() }
      updateState((prev) => prev && withSelfCustodialFiatRates(prev, next))
      setNow(Date.now())
    },
    [updateState],
  )

  const refresh = useCallback(async () => {
    if (!sdk) return
    if (inFlightRef.current) return inFlightRef.current

    const run = (async () => {
      try {
        const rates = await listFiatRates(sdk)
        if (rates.length > 0) persist(rates)
      } catch (err) {
        // Quiet by design: the stored feed stands, and its freshness says how old it is.
        recordErrorOnce(
          "self-custodial-fiat-rates-refresh-failed",
          err instanceof Error ? err : new Error(`Fiat rate refresh failed: ${err}`),
        )
      } finally {
        inFlightRef.current = null
      }
    })()

    inFlightRef.current = run
    return run
  }, [sdk, persist])

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

  useEffect(() => {
    const timer = setInterval(() => refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const value = useMemo<FiatRatesContextValue>(() => {
    if (!stored || stored.rates.length === 0) {
      return {
        rates: EMPTY_RATES,
        fetchedAt: null,
        freshness: RateFreshness.Expired,
        refresh,
      }
    }
    return {
      rates: stored.rates,
      fetchedAt: stored.fetchedAt,
      freshness: rateFreshness(stored.fetchedAt, now),
      refresh,
    }
  }, [stored, now, refresh])

  return <FiatRatesContext.Provider value={value}>{children}</FiatRatesContext.Provider>
}
