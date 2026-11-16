import { act, renderHook } from "@testing-library/react-native"
import Crypto from "react-native-quick-crypto"

import { HomeAuthedDocument, PaymentSendResult } from "@app/graphql/generated"
import { hasIdempotencyKey } from "@app/graphql/retry-policy"
import { IdempotencyKeyRef } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import {
  IDEMPOTENCY_KEY_UNAVAILABLE,
  useSendPayment,
} from "@app/screens/send-bitcoin-screen/use-send-payment"

/** The nine payment mutations, by the key each one is handed to sendPaymentMutation under. */
const MUTATION_NAMES = [
  "intraLedgerPaymentSend",
  "intraLedgerUsdPaymentSend",
  "lnInvoicePaymentSend",
  "lnNoAmountInvoicePaymentSend",
  "lnNoAmountUsdInvoicePaymentSend",
  "onChainPaymentSend",
  "onChainPaymentSendAll",
  "onChainUsdPaymentSend",
  "onChainUsdPaymentSendAsBtcDenominated",
] as const

type MutationOptions = { context?: { headers?: Record<string, string> } }

const mockHookOptions: unknown[] = []
const mockMutateFns: Record<string, jest.Mock> = {}

// Spread the real module so every export the graph pulls in beyond these nine hooks
// (PaymentSendResult, HomeAuthedDocument, the fee-probe hooks reached through
// payment-details/index.types) keeps tracking codegen instead of silently becoming
// undefined.
jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  const hooks: Record<string, unknown> = {}
  const HOOK_BY_NAME: Record<string, string> = {
    intraLedgerPaymentSend: "useIntraLedgerPaymentSendMutation",
    intraLedgerUsdPaymentSend: "useIntraLedgerUsdPaymentSendMutation",
    lnInvoicePaymentSend: "useLnInvoicePaymentSendMutation",
    lnNoAmountInvoicePaymentSend: "useLnNoAmountInvoicePaymentSendMutation",
    lnNoAmountUsdInvoicePaymentSend: "useLnNoAmountUsdInvoicePaymentSendMutation",
    onChainPaymentSend: "useOnChainPaymentSendMutation",
    onChainPaymentSendAll: "useOnChainPaymentSendAllMutation",
    onChainUsdPaymentSend: "useOnChainUsdPaymentSendMutation",
    onChainUsdPaymentSendAsBtcDenominated:
      "useOnChainUsdPaymentSendAsBtcDenominatedMutation",
  }
  Object.entries(HOOK_BY_NAME).forEach(([name, hookName]) => {
    hooks[hookName] = (options: unknown) => {
      mockHookOptions.push(options)
      // Created on first use, not at factory time: this factory is hoisted above the
      // mockMutateFns declaration, so touching it any earlier is a TDZ error. Cached per
      // name because the mutate identity sits in sendPayment's useMemo deps — a fresh fn
      // per render would churn the memo every render.
      if (!mockMutateFns[name]) {
        mockMutateFns[name] = jest.fn().mockResolvedValue({ data: {} })
      }
      return [mockMutateFns[name], { loading: false }]
    }
  })
  return { ...actual, ...hooks }
})

const randomUUIDMock = Crypto.randomUUID as jest.Mock

const KEY_A = "11111111-1111-4111-8111-111111111111"
const KEY_B = "22222222-2222-4222-8222-222222222222"
// A non-Once fallback, so an unexpected third mint fails as a visible wrong key rather
// than as a confusing `undefined`.
const KEY_C = "33333333-3333-4333-8333-333333333333"

/** Drives every one of the nine mutations, the way a real payment detail drives one. */
const sendAllMutations =
  (status: PaymentSendResult = PaymentSendResult.Success) =>
  async (fns: Record<string, (options: MutationOptions) => Promise<unknown>>) => {
    for (const name of MUTATION_NAMES) {
      await fns[name]({ variables: { input: {} } } as MutationOptions)
    }
    return { status }
  }

const keysStampedOn = (name: string): string[] =>
  mockMutateFns[name].mock.calls.map(
    ([options]: [MutationOptions]) =>
      options?.context?.headers?.["X-Idempotency-Key"] ?? "",
  )

const allStampedKeys = (): Set<string> =>
  new Set(MUTATION_NAMES.flatMap((name) => keysStampedOn(name)))

const invoke = async (send: (() => Promise<unknown>) | undefined | null) => {
  let result: unknown
  await act(async () => {
    result = await send?.()
  })
  return result
}

describe("useSendPayment idempotency key", () => {
  beforeEach(() => {
    mockHookOptions.length = 0
    // mockClear, not mockReset: reset would strip the mockResolvedValue above.
    Object.values(mockMutateFns).forEach((fn) => fn.mockClear())
    // mockReset (not clearAllMocks) is what flushes a leftover once-queue.
    randomUUIDMock.mockReset()
    randomUUIDMock
      .mockReturnValueOnce(KEY_A)
      .mockReturnValueOnce(KEY_B)
      .mockReturnValue(KEY_C)
  })

  it("does not touch the CSPRNG while rendering", () => {
    renderHook(() => useSendPayment(sendAllMutations(), {}))

    // Minting during render would put a native Nitro call in the render phase, where a
    // throw escapes into the app-wide ErrorBoundary instead of the screen's catch.
    expect(randomUUIDMock).not.toHaveBeenCalled()
  })

  it("asks the home query to refetch on every mutation", () => {
    renderHook(() => useSendPayment(sendAllMutations(), {}))

    expect(mockHookOptions).toHaveLength(MUTATION_NAMES.length)
    mockHookOptions.forEach((options) => {
      expect(options).toEqual({ refetchQueries: [HomeAuthedDocument] })
    })
  })

  it("stamps one CSPRNG-minted key on every payment mutation", async () => {
    const { result } = renderHook(() => useSendPayment(sendAllMutations(), {}))
    await invoke(result.current.sendPayment)

    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    MUTATION_NAMES.forEach((name) => {
      expect(keysStampedOn(name)).toEqual([KEY_A])
    })
  })

  it("passes the header where the transport-retry gate can see it", async () => {
    const { result } = renderHook(() => useSendPayment(sendAllMutations(), {}))
    await invoke(result.current.sendPayment)

    // The real predicate that keeps RetryLink from resending a payment: if the header is
    // renamed or dropped, transport retries silently switch back on for money movement.
    const [options] = mockMutateFns.lnInvoicePaymentSend.mock.calls[0]
    expect(
      hasIdempotencyKey({
        getContext: () => options.context,
      } as unknown as Parameters<typeof hasIdempotencyKey>[0]),
    ).toBe(true)
  })

  it("reuses the intent's key across a remount, so a re-entered send still dedupes", async () => {
    // The ref lives on the payment detail, which outlives the confirmation screen: this
    // is the back-out-and-retry path that used to mint a second key and pay twice.
    const idempotencyKeyRef: IdempotencyKeyRef = {}

    const first = renderHook(() => useSendPayment(sendAllMutations(), idempotencyKeyRef))
    await invoke(first.result.current.sendPayment)
    first.unmount()

    const second = renderHook(() => useSendPayment(sendAllMutations(), idempotencyKeyRef))
    await invoke(second.result.current.sendPayment)

    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(allStampedKeys()).toEqual(new Set([KEY_A]))
  })

  it("mints a fresh key for a different intent, so two payments never share one", async () => {
    const first = renderHook(() => useSendPayment(sendAllMutations(), {}))
    await invoke(first.result.current.sendPayment)
    first.unmount()

    // A new ref is what setAmount/setSendingWalletDescriptor hand back.
    const second = renderHook(() => useSendPayment(sendAllMutations(), {}))
    await invoke(second.result.current.sendPayment)

    expect(randomUUIDMock).toHaveBeenCalledTimes(2)
    expect(allStampedKeys()).toEqual(new Set([KEY_A, KEY_B]))
  })

  it("keeps one key across a re-render", async () => {
    const idempotencyKeyRef: IdempotencyKeyRef = {}
    const { result, rerender } = renderHook(() =>
      useSendPayment(sendAllMutations(), idempotencyKeyRef),
    )
    await invoke(result.current.sendPayment)
    rerender({})
    await invoke(result.current.sendPayment)

    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(allStampedKeys()).toEqual(new Set([KEY_A]))
  })
})

describe("useSendPayment attempt gating", () => {
  beforeEach(() => {
    mockHookOptions.length = 0
    Object.values(mockMutateFns).forEach((fn) => fn.mockClear())
    randomUUIDMock.mockReset()
    randomUUIDMock
      .mockReturnValueOnce(KEY_A)
      .mockReturnValueOnce(KEY_B)
      .mockReturnValue(KEY_C)
  })

  // AlreadyPaid only exists because the mock spreads the real generated module; a
  // hand-stubbed enum would make this case silently undefined and the assertion vacuous.
  const terminalStatuses: [string, PaymentSendResult][] = [
    ["SUCCESS", PaymentSendResult.Success],
    ["PENDING", PaymentSendResult.Pending],
    ["ALREADY_PAID", PaymentSendResult.AlreadyPaid],
  ]

  terminalStatuses.forEach(([label, status]) => {
    it(`withholds a second send after ${label}`, async () => {
      const { result } = renderHook(() => useSendPayment(sendAllMutations(status), {}))
      await invoke(result.current.sendPayment)

      expect(result.current.hasAttemptedSend).toBe(true)
      expect(result.current.sendPayment).toBeUndefined()
    })
  })

  it("reopens the send after a Failure and retries under the same key", async () => {
    const idempotencyKeyRef: IdempotencyKeyRef = {}
    const { result } = renderHook(() =>
      useSendPayment(sendAllMutations(PaymentSendResult.Failure), idempotencyKeyRef),
    )

    await invoke(result.current.sendPayment)
    expect(result.current.sendPayment).toBeDefined()

    await invoke(result.current.sendPayment)

    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(keysStampedOn("intraLedgerPaymentSend")).toEqual([KEY_A, KEY_A])
    // Sticky even though the send reopened: the balance may already be debited.
    expect(result.current.hasAttemptedSend).toBe(true)
  })

  it("reopens the send after a thrown mutation, rethrows, and retries under the same key", async () => {
    // The ambiguous case: the request may have landed. A retry must be possible AND must
    // carry the original key, so a true duplicate comes back as a 409 the screen resolves.
    const idempotencyKeyRef: IdempotencyKeyRef = {}
    const boom = new Error("network died")
    const sendPaymentMutation = jest
      .fn()
      .mockImplementationOnce(async (fns) => {
        await fns.intraLedgerPaymentSend({ variables: { input: {} } })
        throw boom
      })
      .mockImplementationOnce(async (fns) => {
        await fns.intraLedgerPaymentSend({ variables: { input: {} } })
        return { status: PaymentSendResult.Success }
      })

    const { result } = renderHook(() =>
      useSendPayment(sendPaymentMutation, idempotencyKeyRef),
    )

    await act(async () => {
      await expect(result.current.sendPayment?.()).rejects.toThrow("network died")
    })

    expect(result.current.sendPayment).toBeDefined()
    expect(result.current.loading).toBe(false)

    await invoke(result.current.sendPayment)

    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(keysStampedOn("intraLedgerPaymentSend")).toEqual([KEY_A, KEY_A])
  })

  it("sends nothing and does not lock out when the CSPRNG is unavailable", async () => {
    randomUUIDMock.mockReset()
    randomUUIDMock.mockImplementation(() => {
      throw new Error("Random HybridObject not registered")
    })

    const sendPaymentMutation = jest.fn()
    const { result } = renderHook(() => useSendPayment(sendPaymentMutation, {}))

    await act(async () => {
      await expect(result.current.sendPayment?.()).rejects.toThrow(
        IDEMPOTENCY_KEY_UNAVAILABLE,
      )
    })

    // No fallback to a weaker source, and no half-sent payment.
    expect(sendPaymentMutation).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.sendPayment).toBeDefined()
    // Nothing reached the network, so the balance check must stay armed: the flag's
    // contract is "a send attempt reached the network", and here nothing did.
    expect(result.current.hasAttemptedSend).toBe(false)
  })

  it("lets a mutation that bypasses Apollo send without stamping a key", async () => {
    // The self-custodial rail drives its SDK directly and never touches the nine wrapped
    // mutations, so nothing carries the header; the minted key is written to the ref and
    // goes unused. Replay protection on that rail is the SDK's own concern — this pins
    // that the new call shape neither breaks the rail nor pretends to cover it.
    const idempotencyKeyRef: IdempotencyKeyRef = {}
    const sdkSend = jest.fn().mockResolvedValue(undefined)
    const sendPaymentMutation = async () => {
      await sdkSend()
      return { status: PaymentSendResult.Success }
    }

    const { result } = renderHook(() =>
      useSendPayment(sendPaymentMutation, idempotencyKeyRef),
    )
    const sendResult = await invoke(result.current.sendPayment)

    expect(sdkSend).toHaveBeenCalledTimes(1)
    MUTATION_NAMES.forEach((name) => {
      expect(mockMutateFns[name]).not.toHaveBeenCalled()
    })
    expect(idempotencyKeyRef.current).toBe(KEY_A)
    expect(sendResult).toEqual({ status: PaymentSendResult.Success })
    expect(result.current.hasAttemptedSend).toBe(true)
    expect(result.current.sendPayment).toBeUndefined()
  })
})
