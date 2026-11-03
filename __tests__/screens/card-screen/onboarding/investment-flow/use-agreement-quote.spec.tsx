import React, { PropsWithChildren } from "react"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import { InMemoryCache } from "@apollo/client"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { createCache } from "@app/graphql/cache"
import { RealtimePriceDocument, RealtimePriceQuery } from "@app/graphql/generated"
import { useAgreementQuote } from "@app/screens/card-screen/onboarding/investment-flow/use-agreement-quote"

/** 2026-09-14 22:00 UTC, as the price service stamps it: in seconds. */
const FRESH_TIMESTAMP = 1_789_423_200
/** A day earlier, as a price persisted from an earlier session would be. */
const STALE_TIMESTAMP = FRESH_TIMESTAMP - 24 * 60 * 60

/** How long the network takes to answer, so the cache has its chance to show. */
const NETWORK_DELAY_MS = 50

type Price = {
  timestamp: number
  /** Display-currency cents per satoshi, scaled by 10^12 as the API sends it. */
  btcSatPriceBase: number
  /** Display-currency cents per US cent, scaled by 10^6 as the API sends it. */
  usdCentPriceBase?: number
  denominatorCurrency?: string
}

const priceData = ({
  timestamp,
  btcSatPriceBase,
  usdCentPriceBase = 1_000_000,
  denominatorCurrency = "USD",
}: Price): RealtimePriceQuery => ({
  __typename: "Query",
  me: {
    __typename: "User",
    id: "user-1",
    defaultAccount: {
      __typename: "ConsumerAccount",
      id: "account-1",
      realtimePrice: {
        __typename: "RealtimePrice",
        id: "price-1",
        timestamp,
        denominatorCurrency,
        btcSatPrice: {
          __typename: "PriceOfOneSatInMinorUnit",
          base: btcSatPriceBase,
          offset: 12,
        },
        usdCentPrice: {
          __typename: "PriceOfOneUsdCentInMinorUnit",
          base: usdCentPriceBase,
          offset: 6,
        },
      },
    },
  },
})

/** $100,000 per bitcoin is 0.1 cents per satoshi. */
const AT_100K = 100_000_000_000
/** $105,000 per bitcoin. */
const AT_105K = 105_000_000_000

const networkAnswer = (price: Price, delay = NETWORK_DELAY_MS): MockedResponse => ({
  request: { query: RealtimePriceDocument },
  result: { data: priceData(price) },
  delay,
})

const wrapper = (mocks: ReadonlyArray<MockedResponse>, cache: InMemoryCache) => {
  const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
    <MockedProvider mocks={mocks} cache={cache}>
      {children}
    </MockedProvider>
  )
  return Wrapper
}

/** A cache holding what an earlier session persisted. */
const cacheWith = (price: Price): InMemoryCache => {
  const cache = createCache()
  cache.writeQuery({ query: RealtimePriceDocument, data: priceData(price) })
  return cache
}

describe("useAgreementQuote", () => {
  /** The regression: a price restored from the cache would be minted at once and stamped
   *  as current. The quote waits for the network, and carries what the network said. */
  it("ignores a price restored from the cache and quotes the network's answer", async () => {
    const cache = cacheWith({ timestamp: STALE_TIMESTAMP, btcSatPriceBase: AT_100K })
    const { result } = renderHook(() => useAgreementQuote(), {
      wrapper: wrapper(
        [networkAnswer({ timestamp: FRESH_TIMESTAMP, btcSatPriceBase: AT_105K })],
        cache,
      ),
    })

    expect(result.current.quote).toBeNull()

    await waitFor(() => expect(result.current.quote).not.toBeNull())
    expect(result.current.quote).toMatchObject({
      usdCentsPerBtc: 10_500_000,
      quotedAt: new Date(FRESH_TIMESTAMP * 1000),
    })
  })

  it("dates the quote as it reaches the device", async () => {
    const before = Date.now()
    const { result } = renderHook(() => useAgreementQuote(), {
      wrapper: wrapper(
        [networkAnswer({ timestamp: STALE_TIMESTAMP, btcSatPriceBase: AT_100K })],
        createCache(),
      ),
    })

    await waitFor(() => expect(result.current.quote).not.toBeNull())
    const receivedAt = result.current.quote?.receivedAt.getTime() ?? 0
    expect(receivedAt).toBeGreaterThanOrEqual(before)
    expect(receivedAt).toBeLessThanOrEqual(Date.now())
  })

  /** Both prices come in the investor's display currency; their ratio is the dollar
   *  price, which is what the agreement states. */
  it("quotes the dollar price whatever currency the investor reads amounts in", async () => {
    const { result } = renderHook(() => useAgreementQuote(), {
      wrapper: wrapper(
        [
          networkAnswer({
            timestamp: FRESH_TIMESTAMP,
            denominatorCurrency: "EUR",
            btcSatPriceBase: 90_000_000_000,
            usdCentPriceBase: 900_000,
          }),
        ],
        createCache(),
      ),
    })

    await waitFor(() => expect(result.current.quote?.usdCentsPerBtc).toBe(10_000_000))
  })

  it("asks the network again on refresh and quotes the new answer", async () => {
    const { result } = renderHook(() => useAgreementQuote(), {
      wrapper: wrapper(
        [
          networkAnswer({ timestamp: STALE_TIMESTAMP, btcSatPriceBase: AT_100K }, 0),
          networkAnswer({ timestamp: FRESH_TIMESTAMP, btcSatPriceBase: AT_105K }, 0),
        ],
        createCache(),
      ),
    })
    await waitFor(() => expect(result.current.quote).not.toBeNull())

    await act(async () => {
      result.current.refresh()
    })

    await waitFor(() =>
      expect(result.current.quote?.quotedAt).toEqual(new Date(FRESH_TIMESTAMP * 1000)),
    )
    expect(result.current.quote?.usdCentsPerBtc).toBe(10_500_000)
  })

  /** Offline, the refresh fails: the old quote stands, and the next mint refuses it
   *  again rather than the failure escaping unhandled. */
  it("keeps the last quote when a refresh fails", async () => {
    const { result } = renderHook(() => useAgreementQuote(), {
      wrapper: wrapper(
        [
          networkAnswer({ timestamp: STALE_TIMESTAMP, btcSatPriceBase: AT_100K }, 0),
          { request: { query: RealtimePriceDocument }, error: new Error("offline") },
        ],
        createCache(),
      ),
    })
    await waitFor(() => expect(result.current.quote).not.toBeNull())
    const lastQuote = result.current.quote

    await act(async () => {
      result.current.refresh()
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })

    expect(result.current.quote).toBe(lastQuote)
  })
})
