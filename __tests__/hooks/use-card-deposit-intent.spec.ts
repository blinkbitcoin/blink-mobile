import { ApolloError } from "@apollo/client"
import { GraphQLError } from "graphql"
import { act, renderHook } from "@testing-library/react-native"

import {
  CardCollateralDepositIntentStatus,
  CardCollateralDepositMethod,
} from "@app/graphql/generated"
import {
  useCardDepositIntentCreate,
  useCardDepositIntentStatus,
} from "@app/hooks/use-card-deposit-intent"

const mockCreateIntent = jest.fn()
let mockCreateLoading = false
const mockUseIntentQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardCollateralDepositIntentCreateMutation: () => [
    mockCreateIntent,
    { loading: mockCreateLoading },
  ],
  useCardCollateralDepositIntentQuery: (options: Record<string, unknown>) =>
    mockUseIntentQuery(options),
}))

const createdIntent = {
  __typename: "CardCollateralDepositIntentCreatePayload" as const,
  intentId: "intent-1",
  method: CardCollateralDepositMethod.Lightning,
  destination: "lnbcrt214200n1invoice",
  expiresAt: "2026-11-26T20:00:00Z",
}

const refusal = (message: string, extensions: Record<string, unknown>) =>
  new ApolloError({ graphQLErrors: [new GraphQLError(message, { extensions })] })

describe("useCardDepositIntentCreate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateLoading = false
  })

  it("asks blink-card for a deposit of the amount, by the method", async () => {
    mockCreateIntent.mockResolvedValue({
      data: { cardCollateralDepositIntentCreate: createdIntent },
    })
    const { result } = renderHook(() => useCardDepositIntentCreate())

    let answer: Awaited<ReturnType<typeof result.current.create>> | undefined
    await act(async () => {
      answer = await result.current.create(21420, CardCollateralDepositMethod.Lightning)
    })

    expect(mockCreateIntent).toHaveBeenCalledWith({
      variables: {
        input: { amountSats: 21420, method: CardCollateralDepositMethod.Lightning },
      },
    })
    expect(answer).toEqual({
      intent: {
        intentId: "intent-1",
        method: CardCollateralDepositMethod.Lightning,
        destination: "lnbcrt214200n1invoice",
        expiresAt: "2026-11-26T20:00:00Z",
      },
    })
  })

  it("hands back blink-card's code and wait for a create too soon", async () => {
    mockCreateIntent.mockRejectedValue(
      refusal("Rate limit exceeded", {
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: 22,
      }),
    )
    const { result } = renderHook(() => useCardDepositIntentCreate())

    let answer: Awaited<ReturnType<typeof result.current.create>> | undefined
    await act(async () => {
      answer = await result.current.create(21420, CardCollateralDepositMethod.Lightning)
    })

    expect(answer).toEqual({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded",
        retryAfterSeconds: 22,
      },
    })
  })

  it("hands back a refusal's code without a wait when there is none", async () => {
    mockCreateIntent.mockRejectedValue(
      refusal("Too many pending collateral deposit intents for this account", {
        code: "TOO_MANY_PENDING_DEPOSIT_INTENTS",
      }),
    )
    const { result } = renderHook(() => useCardDepositIntentCreate())

    let answer: Awaited<ReturnType<typeof result.current.create>> | undefined
    await act(async () => {
      answer = await result.current.create(21420, CardCollateralDepositMethod.Onchain)
    })

    expect(answer).toEqual({
      error: {
        code: "TOO_MANY_PENDING_DEPOSIT_INTENTS",
        message: "Too many pending collateral deposit intents for this account",
        retryAfterSeconds: undefined,
      },
    })
  })

  it("leaves out extensions that are not what blink-card sends", async () => {
    mockCreateIntent.mockRejectedValue(
      refusal("Odd answer", { code: 42, retryAfterSeconds: "soon" }),
    )
    const { result } = renderHook(() => useCardDepositIntentCreate())

    let answer: Awaited<ReturnType<typeof result.current.create>> | undefined
    await act(async () => {
      answer = await result.current.create(21420, CardCollateralDepositMethod.Lightning)
    })

    expect(answer).toEqual({
      error: { code: undefined, message: "Odd answer", retryAfterSeconds: undefined },
    })
  })

  it("hands back a request that failed on the way with its message and no code", async () => {
    mockCreateIntent.mockRejectedValue(new Error("Network request failed"))
    const { result } = renderHook(() => useCardDepositIntentCreate())

    let answer: Awaited<ReturnType<typeof result.current.create>> | undefined
    await act(async () => {
      answer = await result.current.create(21420, CardCollateralDepositMethod.Lightning)
    })

    expect(answer).toEqual({ error: { message: "Network request failed" } })
  })

  it("hands back anything thrown that is not an error as its text", async () => {
    mockCreateIntent.mockRejectedValue("offline")
    const { result } = renderHook(() => useCardDepositIntentCreate())

    let answer: Awaited<ReturnType<typeof result.current.create>> | undefined
    await act(async () => {
      answer = await result.current.create(21420, CardCollateralDepositMethod.Lightning)
    })

    expect(answer).toEqual({ error: { message: "offline" } })
  })

  it("hands back an answer without a deposit as an error", async () => {
    mockCreateIntent.mockResolvedValue({ data: null })
    const { result } = renderHook(() => useCardDepositIntentCreate())

    let answer: Awaited<ReturnType<typeof result.current.create>> | undefined
    await act(async () => {
      answer = await result.current.create(21420, CardCollateralDepositMethod.Lightning)
    })

    expect(answer).toEqual({ error: { message: "No deposit intent was created" } })
  })

  it("tells while the create is out", () => {
    mockCreateLoading = true
    const { result } = renderHook(() => useCardDepositIntentCreate())

    expect(result.current.loading).toBe(true)
  })
})

describe("useCardDepositIntentStatus", () => {
  const mockStartPolling = jest.fn()
  const mockStopPolling = jest.fn()

  const answerWith = (intent: Record<string, unknown> | null | undefined) =>
    mockUseIntentQuery.mockReturnValue({
      data: intent === undefined ? undefined : { cardCollateralDepositIntent: intent },
      startPolling: mockStartPolling,
      stopPolling: mockStopPolling,
    })

  const intentAt = (
    status: CardCollateralDepositIntentStatus,
    creditedSats: number | null = null,
  ) => ({
    __typename: "CardCollateralDepositIntent",
    id: "intent-1",
    status,
    creditedSats,
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reads nothing until there is a deposit to follow", () => {
    answerWith(undefined)
    const { result } = renderHook(() => useCardDepositIntentStatus(undefined))

    expect(mockUseIntentQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
    expect(mockStartPolling).not.toHaveBeenCalled()
    expect(result.current).toEqual({
      status: undefined,
      creditedSats: undefined,
      isFinal: false,
    })
  })

  it("asks the network for the deposit, every time", () => {
    answerWith(undefined)
    renderHook(() => useCardDepositIntentStatus("intent-1"))

    expect(mockUseIntentQuery).toHaveBeenCalledWith({
      variables: { intentId: "intent-1" },
      skip: false,
      fetchPolicy: "network-only",
    })
  })

  it("keeps asking while the deposit is on its way", () => {
    answerWith(intentAt(CardCollateralDepositIntentStatus.Processing))
    const { result } = renderHook(() => useCardDepositIntentStatus("intent-1"))

    expect(mockStartPolling).toHaveBeenCalledWith(5000)
    expect(result.current.isFinal).toBe(false)
    expect(result.current.status).toBe(CardCollateralDepositIntentStatus.Processing)
  })

  it("keeps asking while blink-card does not know the deposit yet", () => {
    answerWith(null)
    const { result } = renderHook(() => useCardDepositIntentStatus("intent-1"))

    expect(mockStartPolling).toHaveBeenCalledWith(5000)
    expect(result.current.status).toBeUndefined()
  })

  const finalStatuses = [
    CardCollateralDepositIntentStatus.Consumed,
    CardCollateralDepositIntentStatus.Expired,
    CardCollateralDepositIntentStatus.Failed,
  ]

  finalStatuses.forEach((status) =>
    it(`stops asking once the deposit is ${status}`, () => {
      answerWith(intentAt(CardCollateralDepositIntentStatus.Pending))
      const { rerender, result } = renderHook(() =>
        useCardDepositIntentStatus("intent-1"),
      )
      expect(mockStartPolling).toHaveBeenCalledTimes(1)

      answerWith(intentAt(status))
      rerender({})

      expect(mockStopPolling).toHaveBeenCalledTimes(1)
      expect(result.current.isFinal).toBe(true)
      expect(mockStartPolling).toHaveBeenCalledTimes(1)
    }),
  )

  it("tells the sats a credited deposit added", () => {
    answerWith(intentAt(CardCollateralDepositIntentStatus.Consumed, 21420))
    const { result } = renderHook(() => useCardDepositIntentStatus("intent-1"))

    expect(result.current.creditedSats).toBe(21420)
    expect(mockStartPolling).not.toHaveBeenCalled()
  })
})
