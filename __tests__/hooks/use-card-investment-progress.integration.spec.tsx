import React, { PropsWithChildren } from "react"
import { act, render, renderHook, waitFor } from "@testing-library/react-native"

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  InMemoryCache,
  Observable,
} from "@apollo/client"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { createCache } from "@app/graphql/cache"
import {
  CardInvestmentAccountDocument,
  CardInvestmentAccountQuery,
} from "@app/graphql/generated"
import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { CardInvestmentProgress } from "@app/types/card-investment"
import { AccountType } from "@app/types/wallet"

/**
 * The hook on a real Apollo cache, with only the network stubbed: the unit spec stands the
 * query in, so what the cache itself can answer, and must not be trusted to, is pinned
 * here.
 */

/** The profile used before on this device, whose identity the persisted cache restores. */
const PREVIOUS_ACCOUNT_ID = "custodial-account-a"
/** The profile this session belongs to, as its server answers. */
const SESSION_ACCOUNT_ID = "custodial-account-b"

const NETWORK_DELAY_MS = 50

const PREVIOUS_INVESTMENT: CardInvestmentProgress = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
  signedAt: 1_757_700_000_000,
  invoice: { paymentRequest: "lnbc-previous-profile", issuedAt: 1_757_701_000_000 },
}
const SESSION_INVESTMENT: CardInvestmentProgress = {
  selectedAmountUsd: 1000,
  settlementSats: 1_268_000,
  signedAt: 1_757_702_000_000,
}

/** The device's store holds both profiles' records, each under its own account. */
const mockPersistentState: PersistentState = {
  schemaVersion: 24,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  cardInvestmentByAccountId: {
    [PREVIOUS_ACCOUNT_ID]: PREVIOUS_INVESTMENT,
    [SESSION_ACCOUNT_ID]: SESSION_INVESTMENT,
  },
}
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { type: AccountType.Custodial, id: "custodial-default" },
  }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

const accountData = (accountId: string): CardInvestmentAccountQuery => ({
  __typename: "Query",
  me: {
    __typename: "User",
    id: `user-of-${accountId}`,
    defaultAccount: {
      __typename: "ConsumerAccount",
      id: accountId,
      wallets: [
        { __typename: "BTCWallet", id: `${accountId}-btc` },
        { __typename: "UsdWallet", id: `${accountId}-usd` },
      ],
    },
  },
})

/** A cache restored from disk, still naming the previous profile's account. */
const cacheOfPreviousProfile = (): InMemoryCache => {
  const cache = createCache()
  cache.writeQuery({
    query: CardInvestmentAccountDocument,
    data: accountData(PREVIOUS_ACCOUNT_ID),
  })
  return cache
}

const sessionAnswer: MockedResponse = {
  request: { query: CardInvestmentAccountDocument },
  result: { data: accountData(SESSION_ACCOUNT_ID) },
  delay: NETWORK_DELAY_MS,
}

const offline: MockedResponse = {
  request: { query: CardInvestmentAccountDocument },
  error: new Error("offline"),
}

const renderWith = (mocks: ReadonlyArray<MockedResponse>) => {
  const cache = cacheOfPreviousProfile()
  const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
    <MockedProvider mocks={mocks} cache={cache}>
      {children}
    </MockedProvider>
  )
  return renderHook(() => useCardInvestmentProgress(), { wrapper: Wrapper })
}

/** What each screen reading the hook last saw, by the name it was mounted under. */
const seenBy: Record<string, string | null> = {}
const Screen: React.FC<{ name: string }> = ({ name }) => {
  seenBy[name] = useCardInvestmentProgress().accountId
  return null
}

/** Screens mounted over one session's client, as the app mounts them over one session. */
const renderScreens = (mocks: ReadonlyArray<MockedResponse>) => {
  const cache = cacheOfPreviousProfile()
  const screensOf = (names: string[]) => (
    <MockedProvider mocks={mocks} cache={cache}>
      <>
        {names.map((name) => (
          <Screen key={name} name={name} />
        ))}
      </>
    </MockedProvider>
  )
  const { rerender } = render(screensOf(["home"]))
  return { mount: (names: string[]) => rerender(screensOf(names)) }
}

describe("useCardInvestmentProgress on a cache restored from another profile", () => {
  /** The previous profile's record is never read, shown or paid under this session:
   *  nothing is known until this session's server has named the account. */
  it("exposes nothing of the previous profile while this session's answer is on its way", async () => {
    const { result } = renderWith([sessionAnswer])

    expect(result.current.accountId).toBeNull()
    expect(result.current.isAccountResolved).toBe(false)
    expect(result.current.progress).toBeNull()
    expect(result.current.walletIds).toEqual([])
    expect(result.current.isInvestmentInvoice("lnbc-previous-profile")).toBe(false)

    await waitFor(() => expect(result.current.accountId).toBe(SESSION_ACCOUNT_ID))
    expect(result.current.progress).toEqual(SESSION_INVESTMENT)
    expect(result.current.walletIds).toEqual([
      `${SESSION_ACCOUNT_ID}-btc`,
      `${SESSION_ACCOUNT_ID}-usd`,
    ])
    expect(result.current.isInvestmentInvoice("lnbc-previous-profile")).toBe(false)
  })

  /** Offline the answer never comes, and the investment stays out of reach rather than
   *  falling back on what the cache remembers. */
  it("stays unresolved offline instead of falling back on the cached account", async () => {
    const { result } = renderWith([offline])

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, NETWORK_DELAY_MS)
      })
    })

    expect(result.current.accountId).toBeNull()
    expect(result.current.progress).toBeNull()
    expect(result.current.isInvestmentInvoice("lnbc-previous-profile")).toBe(false)
  })
})

describe("useCardInvestmentProgress through a switch of custodial profile", () => {
  /** A client whose server names one account, after an optional delay. */
  const clientAnswering = (accountId: string, cache: InMemoryCache, delayMs = 0) =>
    new ApolloClient({
      cache,
      link: new ApolloLink(
        () =>
          new Observable((observer) => {
            const answer = setTimeout(() => {
              observer.next({ data: accountData(accountId) })
              observer.complete()
            }, delayMs)
            return () => clearTimeout(answer)
          }),
      ),
    })

  /** The app swaps the provider's client on a switch while the screens stay mounted;
   *  the new client restores the previous profile's cache. Nothing of the previous
   *  profile is read under the new session, not even for the render the swap happens
   *  in, and the new session's answer is the one that lands. */
  it("exposes nothing of the previous profile after the switch, until the new server answers", async () => {
    const previousSession = clientAnswering(PREVIOUS_ACCOUNT_ID, createCache())
    const newSession = clientAnswering(
      SESSION_ACCOUNT_ID,
      cacheOfPreviousProfile(),
      NETWORK_DELAY_MS,
    )
    const session = { current: previousSession }
    const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
      <ApolloProvider client={session.current}>{children}</ApolloProvider>
    )
    const seen: (string | null)[] = []
    const { result, rerender } = renderHook(
      () => {
        const progress = useCardInvestmentProgress()
        seen.push(progress.accountId)
        return progress
      },
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.accountId).toBe(PREVIOUS_ACCOUNT_ID))

    session.current = newSession
    seen.length = 0
    rerender({})

    expect(result.current.progress).toBeNull()
    await waitFor(() => expect(result.current.accountId).toBe(SESSION_ACCOUNT_ID))
    expect(result.current.progress).toEqual(SESSION_INVESTMENT)
    expect(seen).not.toContain(PREVIOUS_ACCOUNT_ID)
  })
})

describe("useCardInvestmentProgress after a failed request", () => {
  /** How often the hook asks again while the account is unknown. */
  const RETRY_INTERVAL_MS = 15_000

  afterEach(() => {
    jest.useRealTimers()
  })

  /** The home has no "try again" of its own: a request that failed offline is asked
   *  again on an interval, and asking stops once the answer is in. */
  it("asks again on its own until the account is answered, then stops", async () => {
    jest.useFakeTimers()
    let requests = 0
    const link = new ApolloLink(
      () =>
        new Observable((observer) => {
          requests += 1
          if (requests === 1) {
            observer.error(new Error("offline"))
            return
          }
          observer.next({ data: accountData(SESSION_ACCOUNT_ID) })
          observer.complete()
        }),
    )
    const client = new ApolloClient({ cache: cacheOfPreviousProfile(), link })
    const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    )
    const { result } = renderHook(() => useCardInvestmentProgress(), {
      wrapper: Wrapper,
    })
    await act(async () => {})
    expect(result.current.accountId).toBeNull()

    await act(async () => {
      jest.advanceTimersByTime(RETRY_INTERVAL_MS)
    })
    expect(result.current.accountId).toBe(SESSION_ACCOUNT_ID)
    expect(requests).toBe(2)

    await act(async () => {
      jest.advanceTimersByTime(RETRY_INTERVAL_MS * 2)
    })
    expect(requests).toBe(2)
  })
})

describe("useCardInvestmentProgress across one session's screens", () => {
  beforeEach(() => {
    Object.keys(seenBy).forEach((name) => delete seenBy[name])
  })

  /** Once this session's server has named the account, the cache holds it: a screen
   *  opened later, a send flow's receipt, reads it at once rather than waiting on a
   *  request of its own that may fail right after the payment. Only one answer is
   *  mocked, so a second request would come back empty. */
  it("reads the account from the cache on a later screen, without asking again", async () => {
    const { mount } = renderScreens([sessionAnswer])
    await waitFor(() => expect(seenBy.home).toBe(SESSION_ACCOUNT_ID))

    mount(["home", "receipt"])

    expect(seenBy.receipt).toBe(SESSION_ACCOUNT_ID)
  })

  /** A screen whose request failed is not stuck with it: once another screen has had
   *  the answer, it reads the cache on its next render. */
  it("picks up an answer another screen got after its own request failed", async () => {
    const { mount } = renderScreens([offline, sessionAnswer])
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, NETWORK_DELAY_MS)
      })
    })
    expect(seenBy.home).toBeNull()

    mount(["home", "welcome"])
    await waitFor(() => expect(seenBy.welcome).toBe(SESSION_ACCOUNT_ID))
    mount(["home", "welcome"])

    expect(seenBy.home).toBe(SESSION_ACCOUNT_ID)
  })
})
