import React from "react"

import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { renderHook, waitFor } from "@testing-library/react-native"

import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { listFiatCurrencies, listFiatRates } from "@app/self-custodial/bridge/fiat"
import { SelfCustodialFiatRatesProvider } from "@app/self-custodial/providers/fiat-rates"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { withSelfCustodialFiatRates } from "@app/store/persistent-state/self-custodial-fiat-rates"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"
import { DisplayCurrency, toBtcMoneyAmount } from "@app/types/amounts"

/**
 * The case the whole price phase exists for: a cold start with every Blink service
 * unreachable. Nothing is in the Apollo cache — it is deliberately never restored
 * without an auth token — and the SDK's own fiat cache is in memory, so it is empty too.
 * Only what this device persisted stands between the user and a wallet that cannot show
 * a balance.
 *
 * Unlike the sibling specs, this one wires the real provider to the real hook; the
 * seam between them is the thing under test.
 */

jest.mock("@app/self-custodial/bridge/fiat", () => ({
  listFiatRates: jest.fn(),
  listFiatCurrencies: jest.fn(),
}))
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: jest.fn(),
}))
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: jest.fn(),
}))
jest.mock("@app/self-custodial/logging", () => ({ recordErrorOnce: jest.fn() }))
jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => false }))
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { id: "self-custodial-1", type: "self-custodial" },
  }),
}))
jest.mock("@app/hooks/use-effective-display-currency", () => ({
  useEffectiveDisplayCurrency: () => ({
    displayCurrency: "NGN",
    setDisplayCurrency: jest.fn(),
    loading: false,
  }),
}))
/** Every backend query is dead in this scenario. */
jest.mock("@app/graphql/generated", () => ({
  useRealtimePriceQuery: () => ({ data: undefined, loading: false }),
  useRealtimePriceUnauthedQuery: () => ({ data: undefined, loading: false }),
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
}))

const mockedListFiatRates = listFiatRates as jest.MockedFunction<typeof listFiatRates>
const mockedListFiatCurrencies = listFiatCurrencies as jest.MockedFunction<
  typeof listFiatCurrencies
>
const mockedUseWallet = useSelfCustodialWallet as jest.MockedFunction<
  typeof useSelfCustodialWallet
>
const mockedUsePersistentState = usePersistentStateContext as jest.MockedFunction<
  typeof usePersistentStateContext
>

/** One BTC is 150,000,000 NGN, so a sat is 1.5 NGN. */
const feed = [
  { coin: "USD", value: 100_000 },
  { coin: "NGN", value: 150_000_000 },
]

const wrapperWith = (state: typeof defaultPersistentState) => {
  mockedUsePersistentState.mockImplementation(
    () =>
      ({
        persistentState: state,
        updateState: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
  )
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <SelfCustodialFiatRatesProvider>{children}</SelfCustodialFiatRatesProvider>
  )
  return Wrapper
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connectedSdk = {} as any

describe("a cold start with every Blink service unreachable", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseWallet.mockReturnValue({ sdk: connectedSdk } as ReturnType<
      typeof useSelfCustodialWallet
    >)
    // The SDK's fiat feed is unreachable too, which is the harshest case.
    mockedListFiatRates.mockRejectedValue(new Error("offline"))
    mockedListFiatCurrencies.mockRejectedValue(new Error("offline"))
  })

  it("converts a balance from the feed this device persisted", async () => {
    const state = withSelfCustodialFiatRates(defaultPersistentState, {
      rates: feed,
      fetchedAt: Date.now(),
    })

    const { result } = renderHook(() => usePriceConversion(), {
      wrapper: wrapperWith(state),
    })

    const converted = result.current.convertMoneyAmount?.(
      toBtcMoneyAmount(1000),
      DisplayCurrency,
    )
    expect(converted?.amount).toBe(1500)
    expect(converted?.currencyCode).toBe("NGN")
  })

  it("keeps converting after the refresh has failed", async () => {
    const state = withSelfCustodialFiatRates(defaultPersistentState, {
      rates: feed,
      fetchedAt: Date.now(),
    })

    const { result } = renderHook(() => usePriceConversion(), {
      wrapper: wrapperWith(state),
    })

    // A failed refresh is answered by the feed already in hand, not by blanking it.
    await waitFor(() => expect(mockedListFiatRates).toHaveBeenCalled())
    expect(result.current.convertMoneyAmount).toBeDefined()
    expect(result.current.priceFreshness).toBe("fresh")
  })

  it("marks a day-old persisted feed stale, and still converts from it", () => {
    const state = withSelfCustodialFiatRates(defaultPersistentState, {
      rates: feed,
      fetchedAt: Date.now() - 2 * 60 * 60 * 1000,
    })

    const { result } = renderHook(() => usePriceConversion(), {
      wrapper: wrapperWith(state),
    })

    expect(result.current.priceFreshness).toBe("stale")
    expect(result.current.convertMoneyAmount).toBeDefined()
  })

  it("reports Unavailable, not a permanent Pending, when nothing was ever stored", async () => {
    // This is what stops the home balance spinning forever: the caller can tell that
    // no rate is coming and show sats instead.
    const { result } = renderHook(() => usePriceConversion(), {
      wrapper: wrapperWith(defaultPersistentState),
    })

    await waitFor(() => expect(result.current.priceStatus).toBe("unavailable"))
    expect(result.current.convertMoneyAmount).toBeUndefined()
  })

  it("withholds a figure priced off a feed older than a day", async () => {
    const state = withSelfCustodialFiatRates(defaultPersistentState, {
      rates: feed,
      fetchedAt: Date.now() - 25 * 60 * 60 * 1000,
    })

    const { result } = renderHook(() => usePriceConversion(), {
      wrapper: wrapperWith(state),
    })

    // A day-old rate presented as today's is worse than no figure at all.
    await waitFor(() => expect(result.current.priceStatus).toBe("unavailable"))
    expect(result.current.convertMoneyAmount).toBeUndefined()
  })
})
