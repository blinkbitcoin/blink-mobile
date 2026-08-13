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

describe("useSendPayment idempotency key", () => {
  beforeEach(() => {
    mockMutationOptions.length = 0
    jest.clearAllMocks()
  })

  it("uses a CSPRNG-generated UUID as the X-Idempotency-Key on every mutation", () => {
    renderHook(() => useSendPayment(null))

    expect(Crypto.randomUUID).toHaveBeenCalled()
    const expectedKey = (Crypto.randomUUID as jest.Mock).mock.results[0].value

    expect(mockMutationOptions).toHaveLength(9)
    mockMutationOptions.forEach((options) => {
      expect(options).toMatchObject({
        context: { headers: { "X-Idempotency-Key": expectedKey } },
      })
    })
  })

  it("keeps the same key across re-renders (one key per screen session)", () => {
    const { result, rerender } = renderHook(() => useSendPayment(null))
    rerender({})

    const keys = mockMutationOptions.map(
      (options) =>
        (options as { context: { headers: Record<string, string> } }).context.headers[
          "X-Idempotency-Key"
        ],
    )
    expect(new Set(keys).size).toBe(1)
    expect(result.current.sendPayment).toBeUndefined()
  })
})
