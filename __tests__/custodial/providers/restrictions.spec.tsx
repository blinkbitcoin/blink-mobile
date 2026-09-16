import React from "react"
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

let mockAccountType: AccountType = "custodial" as AccountType
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ accountType: mockAccountType }),
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

/** Deduplication off keeps a stale request apart from the next one for the same query, so
 *  the two can come back independently. */
const renderVerdict = ({ queryDeduplication = true } = {}) => {
  const client = new ApolloClient({
    link: scriptedLink,
    cache: new InMemoryCache(),
    queryDeduplication,
  })
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
  return { ...rendered, client, seenStatuses }
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

    it("keeps a served verdict when a later request fails", async () => {
      replies = [answer(false, false), dropRequest]

      const { result, client } = renderVerdict()
      await flushEffects()
      await act(() => refetchOnForeground(client))
      await advance(60_000)

      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: false },
      })
    })

    it("reads Unknown, without retrying, when the server answers with no verdict", async () => {
      replies = [answerWithoutVerdict]

      const { result } = renderVerdict()
      await flushEffects()
      await advance(60_000)

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })
      expect(requestCount).toBe(1)
      expect(mockLogError).toHaveBeenCalledWith({
        scope: "custodial-restrictions",
        error: new Error("restrictions query settled without a verdict"),
        context: { failedRetries: 0 },
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
      replies = Array.from({ length: 6 }, () => dropRequest)

      renderVerdict()
      await flushEffects()
      await failThreeRetries()
      await advance(8000)
      await advance(16_000)

      expect(requestCount).toBe(6)
      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "custodial-restrictions",
          context: { failedRetries: 3 },
        }),
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

    it("keeps asking after Unknown and takes the answer when it comes", async () => {
      replies = [dropRequest, dropRequest, dropRequest, dropRequest, answer(false, true)]

      const { result } = renderVerdict()
      await flushEffects()
      await failThreeRetries()

      expect(result.current.verdict).toEqual({ status: RestrictionVerdictStatus.Unknown })

      await advance(8000)

      expect(result.current.verdict).toEqual({
        status: RestrictionVerdictStatus.Served,
        restrictions: { dollarBalance: false, transfer: true },
      })
    })

    it("waits no longer than the cap between retries", async () => {
      replies = Array.from({ length: 9 }, () => dropRequest)

      renderVerdict()
      await flushEffects()
      for (const backoff of [1000, 2000, 4000, 8000, 16_000, 32_000]) {
        await advance(backoff)
      }

      expect(requestCount).toBe(7)

      await advance(59_999)
      expect(requestCount).toBe(7)

      await advance(1)
      expect(requestCount).toBe(8)
    })

    it("counts nothing from a retry that returns after the question was dropped", async () => {
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
  })
})
