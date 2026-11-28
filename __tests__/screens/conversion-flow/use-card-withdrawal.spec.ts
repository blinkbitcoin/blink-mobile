import { ApolloError } from "@apollo/client"
import { GraphQLError } from "graphql"
import Crypto from "react-native-quick-crypto"
import { act, renderHook } from "@testing-library/react-native"

import {
  CardCollateralWithdrawalStatus,
  HomeAuthedDocument,
} from "@app/graphql/generated"
import { useCardWithdrawal } from "@app/screens/conversion-flow/hooks/use-card-withdrawal"

const mockWithdraw = jest.fn()
let mockWithdrawing = false
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardCollateralWithdrawMutation: () => [mockWithdraw, { loading: mockWithdrawing }],
}))

const mockUuid = Crypto.randomUUID as jest.Mock

const mockLL = {
  common: { error: () => "Something went wrong" },
  CardFlow: {
    CardBalanceTransfer: {
      insufficient: () => "Not enough on the card",
      inReview: () => "We're checking this transfer",
    },
  },
}
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: mockLL }),
}))

const mockHaptic = jest.fn()
jest.mock("@app/utils/helper", () => ({
  triggerHapticFeedback: (...args: unknown[]) => mockHaptic(...args),
}))

const mockRecordAppError = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
}))

const withdrawalAt = (status: CardCollateralWithdrawalStatus) => ({
  data: {
    cardCollateralWithdraw: {
      __typename: "CardCollateralWithdrawal",
      id: "withdrawal-1",
      amountSats: 21420,
      status,
      requestedAt: "2026-11-26T19:00:00Z",
    },
  },
})

const refusal = (code: string) =>
  new ApolloError({
    graphQLErrors: [new GraphQLError("Refused", { extensions: { code } })],
  })

describe("useCardWithdrawal", () => {
  const onSuccess = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockWithdrawing = false
    mockUuid.mockReset()
    mockUuid.mockReturnValueOnce("key-1").mockReturnValueOnce("key-2")
    mockWithdraw.mockResolvedValue(withdrawalAt(CardCollateralWithdrawalStatus.Completed))
  })

  const run = async (hook: { current: ReturnType<typeof useCardWithdrawal> }) => {
    await act(async () => {
      await hook.current.execute({ amountSats: 21420 })
    })
  }

  it("moves the sats to the Bitcoin wallet under a key of its own", async () => {
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await run(result)

    expect(mockWithdraw).toHaveBeenCalledWith({
      variables: { input: { amountSats: 21420, idempotencyKey: "key-1" } },
      refetchQueries: [HomeAuthedDocument],
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(mockHaptic).toHaveBeenCalledWith("notificationSuccess")
  })

  it("counts a withdrawal still on its way as done for the member", async () => {
    mockWithdraw.mockResolvedValue(
      withdrawalAt(CardCollateralWithdrawalStatus.Processing),
    )
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await run(result)

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("sends the same key again on a retry after a lost answer", async () => {
    mockWithdraw.mockRejectedValueOnce(new Error("Network request failed"))
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await run(result)
    expect(result.current.errorMessage).toBe("Network request failed")
    await run(result)

    const keys = mockWithdraw.mock.calls.map(
      ([options]) => options.variables.input.idempotencyKey,
    )
    expect(keys).toEqual(["key-1", "key-1"])
    expect(mockRecordAppError).toHaveBeenCalled()
  })

  it("says the Card Balance falls short, and starts a new move next time", async () => {
    mockWithdraw.mockResolvedValueOnce(
      withdrawalAt(CardCollateralWithdrawalStatus.Refused),
    )
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await run(result)
    expect(result.current.errorMessage).toBe("Not enough on the card")
    await run(result)

    const keys = mockWithdraw.mock.calls.map(
      ([options]) => options.variables.input.idempotencyKey,
    )
    expect(keys).toEqual(["key-1", "key-2"])
  })

  it("says the Card Balance falls short when blink-card refuses with its code", async () => {
    mockWithdraw.mockRejectedValueOnce(refusal("INSUFFICIENT_CARD_BALANCE"))
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await run(result)
    expect(result.current.errorMessage).toBe("Not enough on the card")
    await run(result)

    const keys = mockWithdraw.mock.calls.map(
      ([options]) => options.variables.input.idempotencyKey,
    )
    expect(keys).toEqual(["key-1", "key-2"])
    expect(mockRecordAppError).not.toHaveBeenCalled()
  })

  it("shows another refusal's message and keeps the key", async () => {
    mockWithdraw.mockRejectedValueOnce(refusal("SERVICE_UNAVAILABLE"))
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await run(result)
    expect(result.current.errorMessage).toBe("Refused")
    await run(result)

    const keys = mockWithdraw.mock.calls.map(
      ([options]) => options.variables.input.idempotencyKey,
    )
    expect(keys).toEqual(["key-1", "key-1"])
  })

  it("says support is checking a withdrawal left in review", async () => {
    mockWithdraw.mockResolvedValue(withdrawalAt(CardCollateralWithdrawalStatus.InReview))
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await run(result)

    expect(result.current.errorMessage).toBe("We're checking this transfer")
    expect(mockRecordAppError).toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("shows a generic error for an answer without a withdrawal", async () => {
    mockWithdraw.mockResolvedValue({ data: null })
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await run(result)

    expect(result.current.errorMessage).toBe("Something went wrong")
    expect(mockHaptic).toHaveBeenCalledWith("notificationError")
  })

  it("withdraws once while a withdrawal is out", async () => {
    let answer: (value: unknown) => void = () => undefined
    mockWithdraw.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    await act(async () => {
      const first = result.current.execute({ amountSats: 21420 })
      const second = result.current.execute({ amountSats: 21420 })
      answer(withdrawalAt(CardCollateralWithdrawalStatus.Completed))
      await Promise.all([first, second])
    })

    expect(mockWithdraw).toHaveBeenCalledTimes(1)
  })

  it("tells while the withdrawal is out", () => {
    mockWithdrawing = true
    const { result } = renderHook(() => useCardWithdrawal({ onSuccess }))

    expect(result.current.loading).toBe(true)
  })
})
