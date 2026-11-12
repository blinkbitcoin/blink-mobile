/**
 * The ATM controls against a real Apollo client and the app's cache, where the hook spec
 * mocks the query away. What only this level can show: after a save whose answer was lost
 * the client still holds the card from before, so the hook, not Apollo, is what keeps that
 * card off the screen until the server says what it holds, and keeps it off when that read
 * fails too.
 */
import React from "react"
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  FetchResult,
  NormalizedCacheObject,
  Observable,
} from "@apollo/client"
import { act, renderHook, waitFor } from "@testing-library/react-native"
import { GraphQLError } from "graphql"

import { createCache } from "@app/graphql/cache"
import {
  CardSpendingControlsQuery,
  SpendingCategory,
  SpendingPeriod,
} from "@app/graphql/generated"
import { useCardAtmControls } from "@app/screens/card-screen/card-limits-screen/hooks/use-card-atm-controls"

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardLimits: {
          limitMustBePositive: () => "Limit must be greater than zero",
          limitUpdateSuccess: () => "Limit updated successfully",
          limitUpdateError: () => "Failed to update limit",
          atmToggleError: () => "Failed to update ATM withdrawals",
          invalidLimitAmount: () => "Enter a valid amount with up to 2 decimals",
        },
      },
    },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

const controlsWithDailyLimit = (
  limitCents: number | null,
): CardSpendingControlsQuery => ({
  __typename: "Query",
  me: {
    __typename: "User",
    id: "user-1",
    defaultAccount: {
      __typename: "ConsumerAccount",
      id: "account-1",
      cards: [
        {
          __typename: "Card",
          id: "card-1",
          spendingLimits:
            limitCents === null
              ? []
              : [
                  {
                    __typename: "SpendingLimit",
                    category: SpendingCategory.Atm,
                    period: SpendingPeriod.Daily,
                    limitCents,
                  },
                ],
          spendingToggles: [],
        },
      ],
    },
  },
})

type Answer = { data: unknown } | { fails: true } | { refuses: string }

/** A network the test answers by hand, one operation at a time: each request waits for
 *  `answer`, and answering an operation with none waiting fails the test where it happens. */
const makeNetwork = () => {
  const pending: Array<{ operationName: string; settle: (answer: Answer) => void }> = []
  const link = new ApolloLink(
    (operation) =>
      new Observable<FetchResult>((observer) => {
        pending.push({
          operationName: operation.operationName,
          settle: (answer) => {
            if ("fails" in answer) {
              observer.error(new Error("Network request failed"))
              return
            }
            if ("refuses" in answer) {
              observer.next({ data: null, errors: [new GraphQLError(answer.refuses)] })
              observer.complete()
              return
            }
            observer.next({ data: answer.data } as FetchResult)
            observer.complete()
          },
        })
      }),
  )
  const isWaiting = (operationName: string) =>
    pending.some((request) => request.operationName === operationName)
  const answer = async (operationName: string, reply: Answer) => {
    const index = pending.findIndex((request) => request.operationName === operationName)
    if (index < 0) throw new Error(`no ${operationName} request is waiting for an answer`)
    const [request] = pending.splice(index, 1)
    await act(async () => {
      request.settle(reply)
    })
  }
  return { link, answer, isWaiting }
}

const renderControls = (client: ApolloClient<NormalizedCacheObject>) =>
  renderHook(() => useCardAtmControls("card-1"), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  })

/** Loads the controls with a daily ATM limit, then lifts it with an answer that is lost. */
const liftWithLostAnswer = async () => {
  const network = makeNetwork()
  const client = new ApolloClient({ link: network.link, cache: createCache() })
  const { result } = renderControls(client)
  await network.answer("cardSpendingControls", { data: controlsWithDailyLimit(20000) })
  await waitFor(() => expect(result.current.hasAtmControls).toBe(true))
  expect(result.current.atmDailyLimitCents).toBe(20000)

  act(() => {
    result.current.handleUpdateAtmDailyLimit("")
  })
  await network.answer("cardSpendingLimitRemove", { fails: true })
  return { network, result }
}

describe("useCardAtmControls under a real client", () => {
  /** With the client's default error policy a refusal is thrown, not returned, so this is
   *  what tells it apart from a lost answer: it says the save did not land, so the
   *  controls stay as they are and nothing is read again. */
  it("keeps the controls on screen when the server refuses a save", async () => {
    const network = makeNetwork()
    const client = new ApolloClient({ link: network.link, cache: createCache() })
    const { result } = renderControls(client)
    await network.answer("cardSpendingControls", { data: controlsWithDailyLimit(20000) })
    await waitFor(() => expect(result.current.hasAtmControls).toBe(true))

    act(() => {
      result.current.handleUpdateAtmDailyLimit("")
    })
    await network.answer("cardSpendingLimitRemove", { refuses: "Card not found" })

    await waitFor(() => expect(result.current.updatingAtmLimit).toBeNull())
    expect(result.current.hasAtmControls).toBe(true)
    expect(result.current.atmDailyLimitCents).toBe(20000)
    expect(network.isWaiting("cardSpendingControls")).toBe(false)
  })

  it("holds the controls back after a save with no answer, then shows what the server holds", async () => {
    const { network, result } = await liftWithLostAnswer()

    await waitFor(() => expect(result.current.isAtmControlsLoading).toBe(true))
    expect(result.current.hasAtmControls).toBe(false)

    await network.answer("cardSpendingControls", { data: controlsWithDailyLimit(null) })

    await waitFor(() => expect(result.current.hasAtmControls).toBe(true))
    expect(result.current.atmDailyLimitCents).toBeNull()
  })

  /** Apollo keeps the card from before when the read fails, limit included, so this is the
   *  hook declining to show it: the failure stays, with its retry, until a read succeeds. */
  it("keeps the failure, not the card it still holds, when that read fails too", async () => {
    const { network, result } = await liftWithLostAnswer()

    await network.answer("cardSpendingControls", { fails: true })

    await waitFor(() => expect(result.current.hasAtmControlsFailed).toBe(true))
    expect(result.current.hasAtmControls).toBe(false)
    expect(result.current.atmDailyLimitCents).toBe(20000)

    act(() => {
      result.current.retryAtmControls()
    })
    await network.answer("cardSpendingControls", { data: controlsWithDailyLimit(null) })

    await waitFor(() => expect(result.current.hasAtmControls).toBe(true))
    expect(result.current.hasAtmControlsFailed).toBe(false)
    expect(result.current.atmDailyLimitCents).toBeNull()
  })
})
