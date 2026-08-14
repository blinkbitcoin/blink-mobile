import { renderHook } from "@testing-library/react-native"
import Crypto from "react-native-quick-crypto"

import { useSendPayment } from "@app/screens/send-bitcoin-screen/use-send-payment"

const mockMutationOptions: unknown[] = []

jest.mock("@app/graphql/generated", () => {
  const mutationHook = (options: unknown) => {
    mockMutationOptions.push(options)
    return [jest.fn(), { loading: false }]
  }
  return {
    HomeAuthedDocument: "HomeAuthedDocument",
    PaymentSendResult: { Success: "SUCCESS", Failure: "FAILURE", Pending: "PENDING" },
    useIntraLedgerPaymentSendMutation: mutationHook,
    useIntraLedgerUsdPaymentSendMutation: mutationHook,
    useLnInvoicePaymentSendMutation: mutationHook,
    useLnNoAmountInvoicePaymentSendMutation: mutationHook,
    useLnNoAmountUsdInvoicePaymentSendMutation: mutationHook,
    useOnChainPaymentSendMutation: mutationHook,
    useOnChainPaymentSendAllMutation: mutationHook,
    useOnChainUsdPaymentSendAsBtcDenominatedMutation: mutationHook,
    useOnChainUsdPaymentSendMutation: mutationHook,
  }
})

const randomUUIDMock = Crypto.randomUUID as jest.Mock

const KEY_A = "11111111-1111-4111-8111-111111111111"
const KEY_B = "22222222-2222-4222-8222-222222222222"

const idempotencyKeys = () =>
  mockMutationOptions.map(
    (options) =>
      (options as { context: { headers: Record<string, string> } }).context.headers[
        "X-Idempotency-Key"
      ],
  )

describe("useSendPayment idempotency key", () => {
  beforeEach(() => {
    mockMutationOptions.length = 0
    jest.clearAllMocks()
    // Distinct queued values make key churn observable: a second mint would
    // surface as KEY_B and fail the assertions below. mockReset (not clear)
    // flushes any once-queue left over from the previous test.
    randomUUIDMock.mockReset()
    randomUUIDMock.mockReturnValueOnce(KEY_A).mockReturnValueOnce(KEY_B)
  })

  it("uses a CSPRNG-generated UUID as the X-Idempotency-Key on every mutation", () => {
    renderHook(() => useSendPayment(null))

    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(mockMutationOptions).toHaveLength(9)
    mockMutationOptions.forEach((options) => {
      expect(options).toMatchObject({
        context: { headers: { "X-Idempotency-Key": KEY_A } },
      })
    })
  })

  it("keeps the same key across re-renders (one key per screen session)", () => {
    const { rerender } = renderHook(() => useSendPayment(null))
    rerender({})

    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(mockMutationOptions).toHaveLength(18)
    expect(new Set(idempotencyKeys())).toEqual(new Set([KEY_A]))
  })
})
