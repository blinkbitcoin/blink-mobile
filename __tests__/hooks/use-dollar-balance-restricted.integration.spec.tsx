import React from "react"
import { act, renderHook } from "@testing-library/react-native"

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  FetchResult,
  InMemoryCache,
  Observable,
} from "@apollo/client"
import { CustodialRestrictionsProvider } from "@app/custodial/providers/restrictions"
import { CustodialRestrictionsDocument } from "@app/graphql/generated"
import { useDollarBalanceRestriction } from "@app/hooks/use-dollar-balance-restricted"
import { AccountType } from "@app/types/wallet"

import { flushEffects } from "../helpers/flush-effects"

jest.mock("@app/utils/log-error", () => ({
  logError: jest.fn(),
}))

jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: jest.fn(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ accountType: "custodial" }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ loading: false }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    selfCustodialDollarBalanceBlockedCountries: [],
    selfCustodialTransferBlockedCountries: [],
  }),
  useFeatureFlags: () => ({ remoteConfigReady: true }),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => ({ countryCode: undefined, loading: false }),
  useIpCountryLookup: () => ({ countryCode: undefined, isSettled: true }),
}))

type Reply = (observer: {
  next: (result: FetchResult) => void
  error: (error: Error) => void
  complete: () => void
}) => void

const answer =
  (dollarBalance: boolean): Reply =>
  (observer) => {
    observer.next({
      data: {
        custodialRestrictions: {
          __typename: "CustodialRestrictions",
          dollarBalance,
          transfer: false,
        },
      },
    })
    observer.complete()
  }

const dropRequest: Reply = (observer) =>
  observer.error(new Error("Network request failed"))

let replies: Reply[] = []

const renderRestriction = (accountTypeOverride?: AccountType) => {
  const link = new ApolloLink(
    () =>
      new Observable<FetchResult>((observer) => {
        replies.shift()?.(observer)
      }),
  )
  const client = new ApolloClient({ link, cache: new InMemoryCache() })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ApolloProvider client={client}>
      <CustodialRestrictionsProvider>{children}</CustodialRestrictionsProvider>
    </ApolloProvider>
  )
  return {
    ...renderHook(() => useDollarBalanceRestriction(accountTypeOverride), { wrapper }),
    client,
  }
}

const advance = async (ms: number): Promise<void> => {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
  await flushEffects()
}

describe("useDollarBalanceRestriction over the shared custodial verdict", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] })
    replies = []
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("determines the region when the server restricts the dollar balance", async () => {
    replies = [answer(true)]

    const { result } = renderRestriction()
    await flushEffects()

    expect(result.current).toEqual({
      isRestricted: true,
      isRegionPending: false,
      isRegionDetermined: true,
    })
  })

  it("never determines the region from a server that does not answer", async () => {
    replies = [dropRequest, dropRequest, dropRequest, dropRequest]

    const { result } = renderRestriction()
    await flushEffects()

    expect(result.current).toEqual({
      isRestricted: false,
      isRegionPending: true,
      isRegionDetermined: false,
    })

    await advance(1000)
    await advance(2000)
    await advance(4000)

    expect(result.current).toEqual({
      isRestricted: true,
      isRegionPending: false,
      isRegionDetermined: false,
    })
  })

  it("lifts the restriction without a restart once returning to the app gets an answer", async () => {
    replies = [dropRequest, dropRequest, dropRequest, dropRequest, answer(false)]

    const { result, client } = renderRestriction()
    await flushEffects()
    await advance(1000)
    await advance(2000)
    await advance(4000)

    expect(result.current.isRegionDetermined).toBe(false)

    await act(async () => {
      await client
        .refetchQueries({ include: [CustodialRestrictionsDocument] })
        .catch(() => undefined)
    })

    expect(result.current).toEqual({
      isRestricted: false,
      isRegionPending: false,
      isRegionDetermined: true,
    })
  })

  it("keeps the self-custodial evaluation off the server's verdict", async () => {
    replies = [answer(true)]

    const { result } = renderRestriction(AccountType.SelfCustodial)
    await flushEffects()

    expect(result.current).toEqual({
      isRestricted: false,
      isRegionPending: false,
      isRegionDetermined: false,
    })
  })
})
