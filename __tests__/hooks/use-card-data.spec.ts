import React, { PropsWithChildren } from "react"
import { act, renderHook } from "@testing-library/react-hooks"

import { QueryHookOptions, useQuery } from "@apollo/client"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { CardDocument, CardQuery, CardQueryVariables } from "@app/graphql/generated"
import { useCardData } from "@app/hooks/use-card-data"

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockUseCardQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardQuery: (opts: Record<string, unknown>) => mockUseCardQuery(opts),
}))

const mockCard = {
  __typename: "Card" as const,
  id: "card-1",
  lastFour: "4242",
  cardType: "VIRTUAL",
  status: "ACTIVE",
  createdAt: "2024-01-01T00:00:00Z",
}

const mockData = {
  me: {
    __typename: "User" as const,
    id: "user-1",
    defaultAccount: {
      __typename: "ConsumerAccount" as const,
      id: "acct-1",
      cards: [mockCard],
    },
  },
}

describe("useCardData", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
  })

  it("returns card data when authenticated", () => {
    mockUseCardQuery.mockReturnValue({
      data: mockData,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCardData())

    expect(result.current.card).toEqual(mockCard)
    expect(result.current.hasLoaded).toBe(true)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it("returns loading state", () => {
    mockUseCardQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCardData())

    expect(result.current.card).toBeUndefined()
    expect(result.current.hasLoaded).toBe(false)
    expect(result.current.loading).toBe(true)
  })

  it("returns error state", () => {
    const mockError = new Error("Network error")
    mockUseCardQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: mockError,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCardData())

    expect(result.current.error).toBe(mockError)
    expect(result.current.hasLoaded).toBe(false)
  })

  it("returns undefined card when data is null", () => {
    mockUseCardQuery.mockReturnValue({
      data: { me: null },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCardData())

    expect(result.current.card).toBeUndefined()
    expect(result.current.hasLoaded).toBe(true)
  })

  it("skips query when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseCardQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    renderHook(() => useCardData())

    expect(mockUseCardQuery).toHaveBeenCalledWith(expect.objectContaining({ skip: true }))
  })

  it("skips the query when the skip option is passed even while authenticated", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseCardQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    renderHook(() => useCardData({ skip: true }))

    expect(mockUseCardQuery).toHaveBeenCalledWith(expect.objectContaining({ skip: true }))
  })

  it("uses network-only fetch policy", () => {
    mockUseCardQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      refetch: jest.fn(),
    })

    renderHook(() => useCardData())

    expect(mockUseCardQuery).toHaveBeenCalledWith(
      expect.objectContaining({ fetchPolicy: "network-only" }),
    )
  })

  it("returns refetch function", () => {
    const mockRefetch = jest.fn()
    mockUseCardQuery.mockReturnValue({
      data: mockData,
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    const { result } = renderHook(() => useCardData())

    expect(result.current.refetch).toBe(mockRefetch)
  })

  it("returns first card from array", () => {
    const secondCard = { ...mockCard, id: "card-2", lastFour: "9999" }
    mockUseCardQuery.mockReturnValue({
      data: {
        me: {
          ...mockData.me,
          defaultAccount: {
            ...mockData.me.defaultAccount,
            cards: [mockCard, secondCard],
          },
        },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCardData())

    expect(result.current.card?.id).toBe("card-1")
  })
})

describe("useCardData against the Apollo client", () => {
  const cardQueryData = {
    me: {
      __typename: "User",
      id: "user-1",
      defaultAccount: {
        __typename: "ConsumerAccount",
        id: "acct-1",
        cards: [{ ...mockCard, dailyLimitCents: null, monthlyLimitCents: null }],
        cardConsumerApplications: [],
      },
    },
  }

  const mocks: MockedResponse[] = [
    { request: { query: CardDocument }, result: { data: cardQueryData } },
    { request: { query: CardDocument }, error: new Error("card unavailable") },
  ]

  const wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(MockedProvider, { mocks }, children)

  beforeEach(() => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseCardQuery.mockImplementation(
      (options: QueryHookOptions<CardQuery, CardQueryVariables>) =>
        useQuery<CardQuery, CardQueryVariables>(CardDocument, options),
    )
  })

  it("keeps the last answer and stays loaded when a later lookup fails", async () => {
    const { result, waitFor } = renderHook(() => useCardData(), { wrapper })
    await waitFor(() => result.current.hasLoaded)

    await act(async () => {
      await result.current.refetch().catch(() => undefined)
    })

    expect(result.current.error?.message).toBe("card unavailable")
    expect(result.current.hasLoaded).toBe(true)
    expect(result.current.card?.id).toBe("card-1")
  })
})
