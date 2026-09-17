import React from "react"
import { AppState } from "react-native"
import { GraphQLError } from "graphql"
import { act, renderHook } from "@testing-library/react-native"

import {
  ApolloClient,
  ApolloError,
  ApolloLink,
  ApolloProvider,
  FetchResult,
  InMemoryCache,
  NormalizedCacheObject,
  Observable,
} from "@apollo/client"
import {
  CustodialRestrictionsProvider,
  useCustodialRestrictions,
} from "@app/custodial/providers/restrictions"
import { CustodialRestrictionsDocument } from "@app/graphql/generated"
import { RestrictionVerdictStatus } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

import { flushEffects } from "../../helpers/flush-effects"

const mockLogError = jest.fn()
jest.mock("@app/utils/log-error", () => ({
  logError: (args: Record<string, unknown>) => mockLogError(args),
}))

let mockIsAuthed = true
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

let mockAccountType: AccountType | undefined = "custodial" as AccountType
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockAccountType ? { type: mockAccountType } : undefined,
  }),
}))

type RequestObserver = {
  next: (result: FetchResult) => void
  error: (error: Error) => void
  complete: () => void
}

type Reply = (observer: RequestObserver) => void

const answer =
  (dollarBalance: boolean, transfer: boolean): Reply =>
  (observer) => {
    observer.next({
      data: {
        custodialRestrictions: {
          __typename: "CustodialRestrictions",
          dollarBalance,
          transfer,
        },
      },
    })
    observer.complete()
  }

const answerWithoutVerdict: Reply = (observer) => {
  observer.next({ data: null })
  observer.complete()
}

const dropRequest: Reply = (observer) =>
  observer.error(new Error("Network request failed"))

const refuseRequest: Reply = (observer) => {
  observer.next({ errors: [new GraphQLError("Not authorized")] })
  observer.complete()
}

const heldRequests: RequestObserver[] = []
const holdRequest: Reply = (observer) => {
  heldRequests.push(observer)
}

let replies: Reply[] = []
let requestCount = 0

const scriptedLink = new ApolloLink(
  () =>
    new Observable<FetchResult>((observer) => {
      requestCount += 1
      const reply = replies.shift() ?? holdRequest
      reply(observer)
    }),
)

type RenderOptions = {
  queryDeduplication?: boolean
  /** Stands for the cache a previous session persisted and this launch restored. */
  cache?: InMemoryCache
}

const createClient = (queryDeduplication: boolean, cache: InMemoryCache) =>
  new ApolloClient({ link: scriptedLink, cache, queryDeduplication })

/** Deduplication off keeps a stale request apart from the next one for the same query, so
 *  the two can come back independently. */
const renderVerdict = ({
  queryDeduplication = true,
  cache = new InMemoryCache(),
}: RenderOptions = {}) => {
  let client = createClient(queryDeduplication, cache)
  const seenStatuses: RestrictionVerdictStatus[] = []
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ApolloProvider client={client}>
      <CustodialRestrictionsProvider>{children}</CustodialRestrictionsProvider>
    </ApolloProvider>
  )
  const rendered = renderHook(
    () => {
      const restrictions = useCustodialRestrictions()
      seenStatuses.push(restrictions.verdict.status)
      return restrictions
    },
    { wrapper },
  )
  /** What login and logout really do: GaloyClient builds a new client, with a cache of
   *  its own, under the same mounted provider. */
  const swapClient = () => {
    client = createClient(queryDeduplication, new InMemoryCache())
    rendered.rerender({})
  }
  /** Read, never captured: after a swap the client the provider uses is a different one. */
  const getClient = () => client
  return { ...rendered, getClient, seenStatuses, swapClient }
}

/** The same re-ask the app issues on returning to the foreground. */
const refetchOnForeground = async (
  client: ApolloClient<NormalizedCacheObject>,
): Promise<void> => {
  await client
    .refetchQueries({ include: [CustodialRestrictionsDocument] })
    .catch(() => undefined)
}

const advance = async (ms: number): Promise<void> => {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
  await flushEffects()
}

/** The backoff before each retry: 1s, 2s, 4s, doubling. */
const failThreeRetries = async (): Promise<void> => {
  await advance(1000)
  await advance(2000)
  await advance(4000)
}

describe("CustodialRestrictionsProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] })
    /** The jest mock leaves the app state undefined; the poll only runs in the foreground. */
    AppState.currentState = "active"
    mockIsAuthed = true
    mockAccountType = AccountType.Custodial
    replies = []
    requestCount = 0
    heldRequests.length = 0
    mockLogError.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("who is asked about", () => {
    it("asks nothing for a session with no Blink account", async () => {
      mockIsAuthed = false

      const { result } = renderVerdict()
      await flushEffects()

      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.NoAccount,
      })
      expect(requestCount).toBe(0)
    })

    it("asks nothing for a self-custodial account", async () => {
      mockAccountType = AccountType.SelfCustodial

      const { result } = renderVerdict()
      await flushEffects()

      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.NoAccount,
      })
      expect(requestCount).toBe(0)
    })

    it("asks for an authed session whose account the registry has not named yet", async () => {
      mockAccountType = undefined
      replies = [answer(false, false)]

      const { result } = renderVerdict()
      await flushEffects()

      expect(requestCount).toBe(1)
      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: false },
      })
    })

    it("waits, rather than answering, outside the provider", async () => {
      const { result } = renderHook(() => useCustodialRestrictions())

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Pending })
      await expect(result.current.refetch()).resolves.toBeUndefined()
    })
  })

  describe("an answered question", () => {
    it("waits while the first answer is on its way", async () => {
      replies = [holdRequest]

      const { result } = renderVerdict()
      await flushEffects()

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Pending })
    })

    it("takes the server's verdict as given, field by field", async () => {
      replies = [answer(true, false)]

      const { result } = renderVerdict()
      await flushEffects()

      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: true, transfer: false },
      })
      expect(requestCount).toBe(1)
    })

    /** The cache is restored from the previous session on launch, and the verdict follows
     *  the account's current standing, so a cached answer must never stand in for the
     *  server's. */
    it("asks the server rather than reading a verdict a previous session cached", async () => {
      const cache = new InMemoryCache()
      cache.writeQuery({
        query: CustodialRestrictionsDocument,
        data: {
          custodialRestrictions: {
            __typename: "CustodialRestrictions",
            dollarBalance: true,
            transfer: true,
          },
        },
      })
      replies = [answer(false, false)]

      const { result } = renderVerdict({ cache })
      await flushEffects()

      expect(requestCount).toBe(1)
      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: false },
      })
    })

    it("keeps a served verdict when a later request fails, without retrying it", async () => {
      replies = [answer(false, false), dropRequest]

      const { result, getClient } = renderVerdict()
      await flushEffects()
      await act(() => refetchOnForeground(getClient()))
      await advance(60_000)

      expect(requestCount).toBe(2)
      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: false },
      })
    })

    it("reads Unknown, without retrying, when the server answers with no verdict", async () => {
      replies = [answerWithoutVerdict]

      const { result } = renderVerdict()
      await flushEffects()
      /** Everything the backoff could owe, and short of the poll's first tick. */
      await advance(59_999)

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })
      expect(requestCount).toBe(1)
      expect(mockLogError).toHaveBeenCalledWith({
        scope: "custodial-restrictions",
        error: new Error("restrictions query settled without a verdict"),
      })
    })
  })

  describe("a question that was not answered", () => {
    it("keeps waiting after a failed request while retries are owed", async () => {
      replies = [dropRequest]

      const { result } = renderVerdict()
      await flushEffects()

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Pending })
    })

    it("takes the verdict a retry brings without ever reading Unknown", async () => {
      replies = [dropRequest, dropRequest, answer(false, false)]

      const { result, seenStatuses } = renderVerdict()
      await flushEffects()
      await advance(1000)
      await advance(2000)

      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: false },
      })
      expect(seenStatuses).not.toContain(RestrictionVerdictStatus.Unknown)
      expect(mockLogError).not.toHaveBeenCalled()
    })

    it("does not give up while the last retry is still on its way", async () => {
      replies = [dropRequest, dropRequest, dropRequest, holdRequest]

      const { result } = renderVerdict()
      await flushEffects()
      await failThreeRetries()

      expect(requestCount).toBe(4)
      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Pending })

      await advance(60_000)

      expect(requestCount).toBe(4)
      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Pending })

      act(() => {
        heldRequests[0].error(new Error("Network request failed"))
      })
      await flushEffects()

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })
    })

    it("reads Unknown once the retries have failed, never a restriction", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest]

      const { result } = renderVerdict()
      await flushEffects()
      await failThreeRetries()

      expect(requestCount).toBe(4)
      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })
    })

    it("treats a refused request like a lost one", async () => {
      replies = [refuseRequest, refuseRequest, refuseRequest, refuseRequest]

      const { result } = renderVerdict()
      await flushEffects()
      await failThreeRetries()

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })
    })

    it("reports Unknown once, however long it lasts", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest, refuseRequest]

      const { getClient } = renderVerdict()
      await flushEffects()
      await failThreeRetries()
      await act(() => refetchOnForeground(getClient()))

      expect(requestCount).toBe(5)
      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "custodial-restrictions" }),
      )
    })

    it("reports a copy of the query's error, which logError would otherwise rewrite", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest]

      renderVerdict()
      await flushEffects()
      await failThreeRetries()

      const [{ error: reportedError }] = mockLogError.mock.calls[0]
      expect(reportedError).not.toBeInstanceOf(ApolloError)
      expect(reportedError).toMatchObject({
        name: "ApolloError",
        message: "Network request failed",
      })
    })

    it("hands over from the backoff to a once-a-minute poll once the retries are spent", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest]

      renderVerdict()
      await flushEffects()
      await failThreeRetries()

      expect(requestCount).toBe(4)

      await advance(59_999)

      expect(requestCount).toBe(4)

      await advance(1)

      expect(requestCount).toBe(5)
    })

    it("keeps polling while Unknown and stops the moment an answer lands", async () => {
      replies = [
        dropRequest,
        dropRequest,
        dropRequest,
        dropRequest,
        dropRequest,
        answer(false, true),
      ]

      const { result, seenStatuses } = renderVerdict()
      await flushEffects()
      await failThreeRetries()
      await advance(60_000)

      expect(requestCount).toBe(5)
      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })

      await advance(60_000)

      expect(requestCount).toBe(6)
      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: true },
      })

      for (let minute = 0; minute < 10; minute += 1) {
        await advance(60_000)
      }

      expect(requestCount).toBe(6)
      /** A poll must not read as a new question: nothing pends while it runs. */
      expect(seenStatuses.lastIndexOf(RestrictionVerdictStatus.Pending)).toBeLessThan(
        seenStatuses.indexOf(RestrictionVerdictStatus.Unknown),
      )
      expect(mockLogError).toHaveBeenCalledTimes(1)
    })

    it("does not stack a poll on a poll that is still on its way", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest, holdRequest]

      renderVerdict()
      await flushEffects()
      await failThreeRetries()
      await advance(60_000)

      expect(requestCount).toBe(5)

      await advance(60_000)

      expect(requestCount).toBe(5)
    })

    it("skips the poll while the app is in the background", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest, dropRequest]

      renderVerdict()
      await flushEffects()
      await failThreeRetries()

      AppState.currentState = "background"
      try {
        for (let minute = 0; minute < 3; minute += 1) {
          await advance(60_000)
        }

        expect(requestCount).toBe(4)
      } finally {
        AppState.currentState = "active"
      }

      await advance(60_000)

      expect(requestCount).toBe(5)
    })

    it("stops polling when the account it asked about is gone", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest]

      const { rerender } = renderVerdict()
      await flushEffects()
      await failThreeRetries()

      mockIsAuthed = false
      rerender({})
      await flushEffects()
      for (let minute = 0; minute < 3; minute += 1) {
        await advance(60_000)
      }

      expect(requestCount).toBe(4)
    })

    it("takes the answer the next foreground brings after Unknown", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest, answer(false, true)]

      const { result, getClient } = renderVerdict()
      await flushEffects()
      await failThreeRetries()

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })

      await act(() => refetchOnForeground(getClient()))

      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: true },
      })
    })

    it("waits longer before each retry", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest]

      renderVerdict()
      await flushEffects()

      await advance(999)
      expect(requestCount).toBe(1)
      await advance(1)
      expect(requestCount).toBe(2)

      await advance(1999)
      expect(requestCount).toBe(2)
      await advance(1)
      expect(requestCount).toBe(3)

      await advance(3999)
      expect(requestCount).toBe(3)
      await advance(1)
      expect(requestCount).toBe(4)
    })

    it("ignores a retry that returns after the question was dropped", async () => {
      replies = [dropRequest, holdRequest]

      const { result, rerender } = renderVerdict({ queryDeduplication: false })
      await flushEffects()
      await advance(1000)

      expect(requestCount).toBe(2)

      mockIsAuthed = false
      rerender({})
      await flushEffects()

      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.NoAccount,
      })

      replies = [dropRequest, dropRequest, dropRequest, holdRequest]
      mockIsAuthed = true
      rerender({})
      await flushEffects()

      expect(requestCount).toBe(3)

      act(() => {
        heldRequests[0].error(new Error("Network request failed"))
      })
      await flushEffects()
      await failThreeRetries()

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Pending })
    })
  })

  describe("a new client for a new session", () => {
    it("asks afresh, with a full retry budget, after Unknown", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest]

      const { result, swapClient } = renderVerdict()
      await flushEffects()
      await failThreeRetries()

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })

      replies = [dropRequest, dropRequest, dropRequest, answer(false, true)]
      swapClient()
      await flushEffects()
      await failThreeRetries()

      expect(requestCount).toBe(8)
      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: true },
      })
    })

    it("does not carry a served verdict onto a client whose first request fails", async () => {
      replies = [answer(true, true), dropRequest, holdRequest]

      const { result, seenStatuses, swapClient } = renderVerdict()
      await flushEffects()

      expect(result.current.verdict).toMatchObject({
        status: RestrictionVerdictStatus.Served,
      })

      const seenBeforeSwap = seenStatuses.length
      swapClient()
      await flushEffects()
      await advance(1000)

      expect(requestCount).toBe(3)
      expect(seenStatuses.slice(seenBeforeSwap)).not.toContain(
        RestrictionVerdictStatus.Served,
      )
      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Pending })
    })
  })

  describe("refetch", () => {
    it("asks again at once and takes the new verdict", async () => {
      replies = [answer(true, true), answer(false, false)]

      const { result } = renderVerdict()
      await flushEffects()
      await act(() => result.current.refetch())

      expect(requestCount).toBe(2)
      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: false },
      })
    })

    it("asks nothing without an account to ask about", async () => {
      mockIsAuthed = false

      const { result } = renderVerdict()
      await flushEffects()
      await act(() => result.current.refetch())

      expect(requestCount).toBe(0)
    })

    it("never rejects when the request fails", async () => {
      replies = [dropRequest, dropRequest]

      const { result } = renderVerdict()
      await flushEffects()

      await act(async () => {
        await expect(result.current.refetch()).resolves.toBeUndefined()
      })
    })

    it("settles Served on a pull that succeeds mid-backoff and cancels the retries", async () => {
      replies = [dropRequest, answer(false, false)]

      const { result } = renderVerdict()
      await flushEffects()
      await advance(500)
      await act(() => result.current.refetch())

      expect(requestCount).toBe(2)
      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: false },
      })

      await advance(60_000)

      expect(requestCount).toBe(2)
    })

    it("neither spends nor cancels a retry on a pull that fails mid-backoff", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest, dropRequest]

      const { result } = renderVerdict()
      await flushEffects()
      await advance(500)
      await act(() => result.current.refetch())

      expect(requestCount).toBe(2)
      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Pending })

      /** The first retry fires when it was always going to, half a second on. */
      await advance(500)

      expect(requestCount).toBe(3)

      await advance(2000)
      await advance(4000)

      expect(requestCount).toBe(5)
      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })
    })
  })
})
