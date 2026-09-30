import React from "react"

import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { act, render, waitFor } from "@testing-library/react-native"

import { listFiatRates } from "@app/self-custodial/bridge/fiat"
import { RateFreshness, RATES_USABLE_MS } from "@app/types/price"
import {
  SelfCustodialFiatRatesProvider,
  useFiatRates,
} from "@app/self-custodial/providers/fiat-rates"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"
import { Text } from "react-native"

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
jest.mock("@app/self-custodial/logging", () => ({
  recordErrorOnce: jest.fn(),
}))

const mockedListFiatRates = listFiatRates as jest.MockedFunction<typeof listFiatRates>
const mockedUseWallet = useSelfCustodialWallet as jest.MockedFunction<
  typeof useSelfCustodialWallet
>
const mockedUsePersistentState = usePersistentStateContext as jest.MockedFunction<
  typeof usePersistentStateContext
>

const feed = [
  { coin: "USD", value: 100_000 },
  { coin: "NGN", value: 150_000_000 },
]

const Probe: React.FC = () => {
  const { rates, freshness, fetchedAt } = useFiatRates()
  return (
    <Text testID="probe">{`${rates.length}|${freshness}|${fetchedAt ?? "none"}`}</Text>
  )
}

type StateHolder = {
  state: typeof defaultPersistentState
  updateState: jest.Mock
}

const mountWith = (
  stored?: { rates: typeof feed; fetchedAt: number },
  now?: () => number,
) => {
  const holder: StateHolder = {
    state: stored
      ? { ...defaultPersistentState, selfCustodialFiatRates: stored }
      : defaultPersistentState,
    updateState: jest.fn(),
  }
  mockedUsePersistentState.mockImplementation(
    () =>
      ({
        persistentState: holder.state,
        updateState: holder.updateState,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
  )
  const view = render(
    <SelfCustodialFiatRatesProvider now={now}>
      <Probe />
    </SelfCustodialFiatRatesProvider>,
  )
  return { holder, view }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeSdk = {} as any

describe("SelfCustodialFiatRatesProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedListFiatRates.mockReset()
    mockedUseWallet.mockReturnValue({ sdk: fakeSdk } as ReturnType<
      typeof useSelfCustodialWallet
    >)
  })

  it("serves a stored feed on the very first render, before any fetch settles", () => {
    // The cold-start case: nothing has come back from the SDK yet, and the balance
    // header must already have a rate to render against.
    mockedListFiatRates.mockImplementation(() => new Promise(() => {}))
    const fetchedAt = Date.now()

    const { view } = mountWith({ rates: feed, fetchedAt })

    expect(view.getByTestId("probe").props.children).toBe(`2|fresh|${fetchedAt}`)
  })

  it("reports no rates and Expired when nothing has ever been stored", () => {
    mockedListFiatRates.mockImplementation(() => new Promise(() => {}))

    const { view } = mountWith()

    expect(view.getByTestId("probe").props.children).toBe("0|expired|none")
  })

  it("marks a feed older than the usable window Expired rather than serving it", () => {
    mockedListFiatRates.mockImplementation(() => new Promise(() => {}))

    const { view } = mountWith({
      rates: feed,
      fetchedAt: Date.now() - RATES_USABLE_MS - 1,
    })

    expect(view.getByTestId("probe").props.children).toContain(RateFreshness.Expired)
  })

  it("persists what the SDK serves", async () => {
    mockedListFiatRates.mockResolvedValue(feed)

    const { holder } = mountWith()

    await waitFor(() => expect(holder.updateState).toHaveBeenCalled())
    const reducer = holder.updateState.mock.calls[0]?.[0] as (
      prev: typeof defaultPersistentState,
    ) => typeof defaultPersistentState
    expect(reducer(defaultPersistentState).selfCustodialFiatRates?.rates).toEqual(feed)
  })

  it("keeps the stored feed when the fetch fails", async () => {
    mockedListFiatRates.mockRejectedValue(new Error("offline"))
    const fetchedAt = Date.now()

    const { holder, view } = mountWith({ rates: feed, fetchedAt })

    // Anchor the negative: a fetch that never happened would look identical.
    await waitFor(() => expect(mockedListFiatRates).toHaveBeenCalled())
    // A failed refresh is answered by the feed already in hand, not by blanking it.
    await act(async () => {})
    expect(holder.updateState).not.toHaveBeenCalled()
    expect(view.getByTestId("probe").props.children).toBe(`2|fresh|${fetchedAt}`)
  })

  it("does not write an empty feed over a good one", async () => {
    mockedListFiatRates.mockResolvedValue([])

    const { holder } = mountWith({ rates: feed, fetchedAt: Date.now() })

    await waitFor(() => expect(mockedListFiatRates).toHaveBeenCalled())
    await act(async () => {})
    expect(holder.updateState).not.toHaveBeenCalled()
  })

  it("does not ask the SDK before there is one to ask", () => {
    mockedUseWallet.mockReturnValue({ sdk: null } as ReturnType<
      typeof useSelfCustodialWallet
    >)
    mockedListFiatRates.mockResolvedValue(feed)

    const { view } = mountWith()

    // Anchor: the provider really did mount and serve its default.
    expect(view.getByTestId("probe").props.children).toBe("0|expired|none")
    expect(mockedListFiatRates).not.toHaveBeenCalled()
  })

  describe("the injected clock", () => {
    /** Fixed so the freshness windows can be crossed without waiting a day for them,
     *  and so these assertions do not drift with the wall clock. */
    const FIXED_NOW = 1_700_000_000_000

    it("judges freshness against the clock it was given, not the wall clock", () => {
      mockedListFiatRates.mockImplementation(() => new Promise(() => {}))

      const { view } = mountWith(
        // Two hours before the injected now: stale, though its real age is negative.
        { rates: feed, fetchedAt: FIXED_NOW - 2 * 60 * 60 * 1000 },
        () => FIXED_NOW,
      )

      expect(view.getByTestId("probe").props.children).toContain(RateFreshness.Stale)
    })

    it("stamps what it persists with that clock too", async () => {
      mockedListFiatRates.mockResolvedValue(feed)

      const { holder } = mountWith(undefined, () => FIXED_NOW)

      await waitFor(() => expect(holder.updateState).toHaveBeenCalled())
      const reducer = holder.updateState.mock.calls[0]?.[0] as (
        prev: typeof defaultPersistentState,
      ) => typeof defaultPersistentState
      expect(reducer(defaultPersistentState).selfCustodialFiatRates?.fetchedAt).toBe(
        FIXED_NOW,
      )
    })
  })
})
