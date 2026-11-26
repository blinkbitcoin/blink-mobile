import { act, renderHook } from "@testing-library/react-native"

import {
  CardCollateralDepositMethod,
  HomeAuthedDocument,
  PaymentSendResult,
} from "@app/graphql/generated"
import { useCardTopUp } from "@app/screens/conversion-flow/hooks/use-card-top-up"

const mockCreate = jest.fn()
let mockCreating = false
jest.mock("@app/hooks/use-card-deposit-intent", () => ({
  useCardDepositIntentCreate: () => ({ create: mockCreate, loading: mockCreating }),
}))

const mockPay = jest.fn()
let mockPaying = false
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useLnInvoicePaymentSendMutation: () => [mockPay, { loading: mockPaying }],
}))

const mockLL = {
  common: { error: () => "Something went wrong" },
  CardFlow: {
    CardBalanceTransfer: {
      waitAndRetry: ({ seconds }: { seconds: number }) => `Wait ${seconds} seconds`,
      tooManyPending: () => "Too many top-ups waiting",
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

const intent = {
  intentId: "intent-1",
  method: CardCollateralDepositMethod.Lightning,
  destination: "lnbcrt214200n1invoice",
  expiresAt: "2026-11-26T20:00:00Z",
}

const paidWith = (status: PaymentSendResult, message?: string) => ({
  data: {
    lnInvoicePaymentSend: {
      status,
      errors: message ? [{ message }] : [],
    },
  },
})

const request = { walletId: "btc-wallet-id", amountSats: 21420 }

describe("useCardTopUp", () => {
  const onSuccess = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreating = false
    mockPaying = false
    mockCreate.mockResolvedValue({ intent })
    mockPay.mockResolvedValue(paidWith(PaymentSendResult.Success))
  })

  const run = async (
    hook: { current: ReturnType<typeof useCardTopUp> },
    req = request,
  ) => {
    await act(async () => {
      await hook.current.execute(req)
    })
  }

  it("asks blink-card for a Lightning deposit of the amount and pays it from the wallet", async () => {
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)

    expect(mockCreate).toHaveBeenCalledWith(21420, CardCollateralDepositMethod.Lightning)
    expect(mockPay).toHaveBeenCalledWith({
      variables: {
        input: { walletId: "btc-wallet-id", paymentRequest: "lnbcrt214200n1invoice" },
      },
      refetchQueries: [HomeAuthedDocument],
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(mockHaptic).toHaveBeenCalledWith("notificationSuccess")
    expect(result.current.errorMessage).toBeUndefined()
  })

  const paidStatuses = [PaymentSendResult.Pending, PaymentSendResult.AlreadyPaid]
  paidStatuses.forEach((status) =>
    it(`counts a ${status} payment as on its way to the card`, async () => {
      mockPay.mockResolvedValue(paidWith(status))
      const { result } = renderHook(() => useCardTopUp({ onSuccess }))

      await run(result)

      expect(onSuccess).toHaveBeenCalledTimes(1)
    }),
  )

  it("pays the same invoice again on a retry, never a second deposit", async () => {
    mockPay.mockRejectedValueOnce(new Error("Network request failed"))
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)
    expect(result.current.errorMessage).toBe("Network request failed")

    mockPay.mockResolvedValue(paidWith(PaymentSendResult.AlreadyPaid))
    await run(result)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockPay).toHaveBeenCalledTimes(2)
    expect(mockPay.mock.calls[1][0].variables.input.paymentRequest).toBe(
      "lnbcrt214200n1invoice",
    )
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("asks for a new deposit when the amount changed", async () => {
    mockPay.mockResolvedValueOnce(paidWith(PaymentSendResult.Failure, "No funds"))
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)
    await run(result, { ...request, amountSats: 10000 })

    expect(mockCreate).toHaveBeenNthCalledWith(
      2,
      10000,
      CardCollateralDepositMethod.Lightning,
    )
  })

  it("says how long to wait when blink-card asks for it", async () => {
    mockCreate.mockResolvedValue({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded",
        retryAfterSeconds: 22,
      },
    })
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)

    expect(result.current.errorMessage).toBe("Wait 22 seconds")
    expect(mockPay).not.toHaveBeenCalled()
    expect(mockHaptic).toHaveBeenCalledWith("notificationError")
    expect(mockRecordAppError).toHaveBeenCalled()
  })

  it("says there are too many top-ups waiting", async () => {
    mockCreate.mockResolvedValue({
      error: { code: "TOO_MANY_PENDING_DEPOSIT_INTENTS", message: "Too many" },
    })
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)

    expect(result.current.errorMessage).toBe("Too many top-ups waiting")
  })

  const genericRefusals = [
    { code: "RATE_LIMIT_EXCEEDED", message: "Rate limit exceeded" },
    { code: "SERVICE_UNAVAILABLE", message: "Unavailable" },
    { message: "Network request failed" },
  ]
  genericRefusals.forEach((error) =>
    it(`falls back to a generic error for ${error.message}`, async () => {
      mockCreate.mockResolvedValue({ error })
      const { result } = renderHook(() => useCardTopUp({ onSuccess }))

      await run(result)

      expect(result.current.errorMessage).toBe("Something went wrong")
    }),
  )

  it("shows a generic error when no deposit and no refusal came back", async () => {
    mockCreate.mockResolvedValue({})
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)

    expect(result.current.errorMessage).toBe("Something went wrong")
    expect(mockRecordAppError).not.toHaveBeenCalled()
  })

  it("shows the payment's own failure", async () => {
    mockPay.mockResolvedValue(paidWith(PaymentSendResult.Failure, "Insufficient balance"))
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)

    expect(result.current.errorMessage).toBe("Insufficient balance")
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("shows the request's errors when the payment answered with them", async () => {
    mockPay.mockResolvedValue({ data: null, errors: [{ message: "Bad invoice" }] })
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)

    expect(result.current.errorMessage).toBe("Bad invoice")
  })

  it("shows a generic error for a failed payment without a message", async () => {
    mockPay.mockResolvedValue({ data: null })
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await run(result)

    expect(result.current.errorMessage).toBe("Something went wrong")
  })

  it("tops up once while a top-up is out", async () => {
    let answer: (value: unknown) => void = () => undefined
    mockPay.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    const { result } = renderHook(() => useCardTopUp({ onSuccess }))

    await act(async () => {
      const first = result.current.execute(request)
      const second = result.current.execute(request)
      answer(paidWith(PaymentSendResult.Success))
      await Promise.all([first, second])
    })

    expect(mockPay).toHaveBeenCalledTimes(1)
  })

  it("tells while the deposit or the payment is out", () => {
    mockCreating = true
    const { result, rerender } = renderHook(() => useCardTopUp({ onSuccess }))
    expect(result.current.loading).toBe(true)

    mockCreating = false
    mockPaying = true
    rerender({})
    expect(result.current.loading).toBe(true)
  })
})
