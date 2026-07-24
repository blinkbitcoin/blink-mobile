import { act, renderHook } from "@testing-library/react-native"

import { useLnurlWithdrawRedemption } from "@app/screens/redeem-lnurl-withdrawal-screen/hooks/use-lnurl-withdraw-redemption"
import { PaymentResultStatus } from "@app/types/payment"
import { AccountType } from "@app/types/wallet"

import { flushEffects } from "../../../helpers/flush-effects"

const mockUsePayments = jest.fn()
const mockTranslateSdkError = jest.fn()
const mockRedeemingError = jest.fn(() => "fallback-redeeming-error")
const mockGenericError = jest.fn(() => "generic-error")
const mockSubmissionError = jest.fn(() => "submission-error")
const mockWalletNotConnected = jest.fn(() => "wallet-not-connected")
const mockLnInvoiceCreate = jest.fn()
const mockApolloRefetch = jest.fn()
const mockApolloQuery = jest.fn()
const mockUseLnUpdateHashPaid = jest.fn(() => "no-match-hash")
const mockFetch = jest.fn()

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => mockUsePayments(),
}))

jest.mock("@app/self-custodial/hooks", () => ({
  useTranslateSdkError: () => mockTranslateSdkError,
}))

jest.mock("@app/i18n/i18n-react", () => {
  let cached: {
    LL: {
      RedeemBitcoinScreen: {
        redeemingError: () => string
        error: () => string
        submissionError: () => string
        walletNotConnected: () => string
        title: () => string
      }
    }
  }
  return {
    useI18nContext: () => {
      if (!cached) {
        cached = {
          LL: {
            RedeemBitcoinScreen: {
              redeemingError: mockRedeemingError,
              error: mockGenericError,
              submissionError: mockSubmissionError,
              walletNotConnected: mockWalletNotConnected,
              title: () => "Redeem Bitcoin",
            },
          },
        }
      }
      return cached
    },
  }
})

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useLnInvoiceCreateMutation: () => [mockLnInvoiceCreate, { loading: false }],
  }
})

jest.mock("@app/graphql/ln-update-context", () => ({
  useLnUpdateHashPaid: () => mockUseLnUpdateHashPaid(),
}))

// The real Apollo client is referentially stable across renders; the mock must
// be too, or effects keyed on the client identity re-fire on every render.
const mockApolloClientInstance = {
  refetchQueries: (...args: unknown[]) => mockApolloRefetch(...args),
  query: (...args: unknown[]) => mockApolloQuery(...args),
}

jest.mock("@apollo/client", () => {
  const actual = jest.requireActual("@apollo/client")
  return {
    ...actual,
    useApolloClient: () => mockApolloClientInstance,
  }
})

jest.mock("cross-fetch", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockFetch(...args),
}))

const defaultParams = {
  walletId: "btc-wallet-id",
  amountSats: 1500,
  callback: "https://example.com/lnurl/withdraw",
  k1: "random_k1_value",
  defaultDescription: "Redeem",
  minWithdrawableSatoshis: 100,
  maxWithdrawableSatoshis: 5000,
}

describe("useLnurlWithdrawRedemption — self-custodial branch", () => {
  const mockLnurlWithdraw = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePayments.mockReturnValue({
      accountType: AccountType.SelfCustodial,
      lnurlWithdraw: mockLnurlWithdraw,
    })
    mockTranslateSdkError.mockImplementation((code: string | undefined) =>
      code ? `translated:${code}` : undefined,
    )
  })

  it("surfaces a wallet-not-connected error after the bounded wait when the SDK never connects (C1)", () => {
    jest.useFakeTimers()
    try {
      mockUsePayments.mockReturnValue({
        accountType: AccountType.SelfCustodial,
        lnurlWithdraw: undefined,
      })

      const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

      expect(result.current.errorMessage).toBe("")

      act(() => {
        jest.advanceTimersByTime(10_000)
      })

      expect(mockLnurlWithdraw).not.toHaveBeenCalled()
      expect(result.current.paid).toBe(false)
      expect(result.current.errorMessage).toBe("wallet-not-connected")
    } finally {
      jest.useRealTimers()
    }
  })

  it("sets paid=true when the self-custodial adapter resolves with Success", async () => {
    mockLnurlWithdraw.mockResolvedValue({ status: PaymentResultStatus.Success })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(result.current.paid).toBe(true)
    expect(result.current.errorMessage).toBe("")
  })

  it("forwards sats limits as msats (sats * 1000) plus passes through callback / k1 / description / amount and an AbortSignal", async () => {
    mockLnurlWithdraw.mockResolvedValue({ status: PaymentResultStatus.Success })

    renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(mockLnurlWithdraw).toHaveBeenCalledTimes(1)
    const arg = mockLnurlWithdraw.mock.calls[0][0]
    expect(arg.amountSats).toBe(defaultParams.amountSats)
    expect(arg.callback).toBe(defaultParams.callback)
    expect(arg.k1).toBe(defaultParams.k1)
    expect(arg.defaultDescription).toBe(defaultParams.defaultDescription)
    expect(arg.minWithdrawableMsats).toBe(100_000)
    expect(arg.maxWithdrawableMsats).toBe(5_000_000)
    expect(arg.signal).toBeInstanceOf(AbortSignal)
  })

  it("sets the translated SDK error code when the self-custodial adapter resolves Failed", async () => {
    mockLnurlWithdraw.mockResolvedValue({
      status: PaymentResultStatus.Failed,
      errors: [{ message: "sc_insufficient_funds" }],
    })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(result.current.errorMessage).toBe("translated:sc_insufficient_funds")
    expect(result.current.paid).toBe(false)
  })

  it("falls back to LL.RedeemBitcoinScreen.redeemingError() when the SDK error translator returns undefined", async () => {
    mockTranslateSdkError.mockReturnValue(undefined)
    mockLnurlWithdraw.mockResolvedValue({
      status: PaymentResultStatus.Failed,
      errors: [{ message: "unknown_code" }],
    })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(result.current.errorMessage).toBe("fallback-redeeming-error")
  })

  it("aborts the self-custodial AbortController on unmount", async () => {
    let observedSignal: AbortSignal | undefined
    mockLnurlWithdraw.mockImplementationOnce(
      (params: { signal?: AbortSignal }) =>
        new Promise(() => {
          observedSignal = params.signal
        }),
    )

    const { unmount } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(observedSignal?.aborted).toBe(false)
    unmount()
    expect(observedSignal?.aborted).toBe(true)
  })

  it("ignores the self-custodial Failed branch when the hook unmounts before the adapter resolves (cancellation guard)", async () => {
    let resolveAdapter: (value: {
      status: typeof PaymentResultStatus.Failed
      errors: Array<{ message: string }>
    }) => void = () => {}
    mockLnurlWithdraw.mockImplementationOnce(
      () =>
        new Promise<{
          status: typeof PaymentResultStatus.Failed
          errors: Array<{ message: string }>
        }>((resolve) => {
          resolveAdapter = resolve
        }),
    )

    const { unmount } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))
    await flushEffects()

    unmount()

    await act(async () => {
      resolveAdapter({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "sc_insufficient_funds" }],
      })
      await flushEffects()
    })

    expect(mockTranslateSdkError).not.toHaveBeenCalled()
    expect(mockRedeemingError).not.toHaveBeenCalled()
  })

  it("falls back to redeemingError when the self-custodial adapter rejects outright", async () => {
    mockLnurlWithdraw.mockRejectedValueOnce(new Error("adapter exploded"))

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(result.current.errorMessage).toBe("fallback-redeeming-error")
    expect(result.current.paid).toBe(false)
  })

  it("ignores an adapter rejection that lands after unmount (rejection cancellation guard)", async () => {
    let rejectAdapter: (err: Error) => void = () => {}
    mockLnurlWithdraw.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectAdapter = reject
        }),
    )

    const { unmount } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))
    await flushEffects()

    unmount()

    await act(async () => {
      rejectAdapter(new Error("late failure"))
      await flushEffects()
    })

    expect(mockRedeemingError).not.toHaveBeenCalled()
  })

  it("sets pending=true (no error) when the self-custodial adapter resolves Pending (C2)", async () => {
    mockLnurlWithdraw.mockResolvedValue({ status: PaymentResultStatus.Pending })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(result.current.pending).toBe(true)
    expect(result.current.paid).toBe(false)
    expect(result.current.errorMessage).toBe("")
  })

  it("threads the adapter error reason into lnServiceErrorReason (I2)", async () => {
    mockLnurlWithdraw.mockResolvedValue({
      status: PaymentResultStatus.Failed,
      errors: [{ message: "sc_invalid_input", reason: "Voucher already claimed" }],
    })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(result.current.lnServiceErrorReason).toBe("Voucher already claimed")
  })

  it("ignores a stale first resolution after amountSats changes mid-flight (stale resolution)", async () => {
    let resolveFirst: (value: {
      status: typeof PaymentResultStatus.Failed
      errors: Array<{ message: string }>
    }) => void = () => {}
    mockLnurlWithdraw
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce({ status: PaymentResultStatus.Success })

    const { result, rerender } = renderHook(
      (props: typeof defaultParams) => useLnurlWithdrawRedemption(props),
      { initialProps: defaultParams },
    )
    await flushEffects()

    rerender({ ...defaultParams, amountSats: 3000 })
    await flushEffects()

    await act(async () => {
      resolveFirst({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "sc_network_error" }],
      })
      await flushEffects()
    })

    expect(result.current.errorMessage).toBe("")
    expect(mockLnurlWithdraw).toHaveBeenCalledTimes(2)
    expect(mockLnurlWithdraw.mock.calls[1][0].amountSats).toBe(3000)
  })
})

describe("useLnurlWithdrawRedemption — custodial branch", () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
    mockUsePayments.mockReturnValue({
      accountType: AccountType.Custodial,
      lnurlWithdraw: undefined,
    })
    mockUseLnUpdateHashPaid.mockReturnValue("no-match-hash")
    mockLnInvoiceCreate.mockResolvedValue({
      data: { lnInvoiceCreate: { invoice: null, errors: [] } },
    })
    mockApolloQuery.mockResolvedValue({
      data: { lnInvoicePaymentStatusByHash: { status: "PENDING" } },
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("does not attempt the custodial mutation when walletId is missing", async () => {
    renderHook(() =>
      useLnurlWithdrawRedemption({ ...defaultParams, walletId: undefined }),
    )

    await flushEffects()

    expect(mockLnInvoiceCreate).not.toHaveBeenCalled()
  })

  it("dispatches the custodial lnInvoiceCreate mutation with walletId, amountSats and the description as memo", async () => {
    renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(mockLnInvoiceCreate).toHaveBeenCalledTimes(1)
    expect(mockLnInvoiceCreate.mock.calls[0][0]).toEqual({
      variables: {
        input: {
          walletId: "btc-wallet-id",
          amount: 1500,
          memo: "Redeem",
        },
      },
    })
  })

  it("POSTs the generated invoice to the LNURL callback URL with k1 and pr query params", async () => {
    const invoice = {
      paymentRequest: "lnbc-bolt11-string",
      paymentHash: "hash-A",
    }
    mockLnInvoiceCreate.mockResolvedValueOnce({
      data: { lnInvoiceCreate: { invoice, errors: [] } },
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "OK" }),
    })

    renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()
    await flushEffects()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const fetchedUrl = mockFetch.mock.calls[0][0] as string
    expect(fetchedUrl).toContain("k1=random_k1_value")
    expect(fetchedUrl).toContain("pr=lnbc-bolt11-string")
  })

  it("flips paid=true when the LN update hash matches the generated invoice paymentHash, and refetches the Home query", async () => {
    const invoice = { paymentRequest: "lnbc-bolt11-string", paymentHash: "hash-A" }
    mockLnInvoiceCreate.mockResolvedValueOnce({
      data: { lnInvoiceCreate: { invoice, errors: [] } },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "OK" }) })
    mockUseLnUpdateHashPaid.mockReturnValue("hash-A")

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()
    await flushEffects()

    expect(result.current.paid).toBe(true)
    expect(mockApolloRefetch).toHaveBeenCalledTimes(1)
  })

  it("surfaces an error when the mutation resolves without data (no-data contract)", async () => {
    mockLnInvoiceCreate.mockResolvedValueOnce({ data: undefined })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(result.current.errorMessage).toContain("No data returned from lnInvoiceCreate")
  })

  it("sets the localized error message when the mutation returns errors[]", async () => {
    mockLnInvoiceCreate.mockResolvedValueOnce({
      data: { lnInvoiceCreate: { invoice: null, errors: [{ message: "boom" }] } },
    })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(result.current.errorMessage).toBe("generic-error")
    expect(mockGenericError).toHaveBeenCalled()
  })

  it("sets the redeemingError + lnServiceErrorReason when the LNURL callback responds with status != OK and a reason", async () => {
    const invoice = { paymentRequest: "lnbc-bolt11-string", paymentHash: "hash-A" }
    mockLnInvoiceCreate.mockResolvedValueOnce({
      data: { lnInvoiceCreate: { invoice, errors: [] } },
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ERROR", reason: "voucher already used" }),
    })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()
    await flushEffects()

    expect(result.current.errorMessage).toBe("fallback-redeeming-error")
    expect(result.current.lnServiceErrorReason).toBe("voucher already used")
  })

  it("sets the submissionError when the LNURL callback HTTP request itself fails", async () => {
    const invoice = { paymentRequest: "lnbc-bolt11-string", paymentHash: "hash-A" }
    mockLnInvoiceCreate.mockResolvedValueOnce({
      data: { lnInvoiceCreate: { invoice, errors: [] } },
    })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "500",
    })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()
    await flushEffects()

    expect(result.current.errorMessage).toBe("submission-error")
  })

  it("resets a stale errorMessage when a new attempt starts and then succeeds (stale-error reset)", async () => {
    mockLnInvoiceCreate.mockResolvedValueOnce({
      data: { lnInvoiceCreate: { invoice: null, errors: [{ message: "boom" }] } },
    })

    const { result, rerender } = renderHook(
      (props: typeof defaultParams) => useLnurlWithdrawRedemption(props),
      { initialProps: defaultParams },
    )
    await flushEffects()
    expect(result.current.errorMessage).toBe("generic-error")

    const invoice = { paymentRequest: "lnbc-bolt11-string", paymentHash: "hash-B" }
    mockLnInvoiceCreate.mockResolvedValueOnce({
      data: { lnInvoiceCreate: { invoice, errors: [] } },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "OK" }) })
    mockUseLnUpdateHashPaid.mockReturnValue("hash-B")

    rerender({ ...defaultParams, amountSats: 3000 })
    await flushEffects()
    await flushEffects()

    expect(result.current.errorMessage).toBe("")
    expect(result.current.paid).toBe(true)
  })

  it("stays paid=false with no error while the LN hash has not arrived yet (in-flight contract)", async () => {
    const invoice = { paymentRequest: "lnbc-bolt11-string", paymentHash: "hash-A" }
    mockLnInvoiceCreate.mockResolvedValueOnce({
      data: { lnInvoiceCreate: { invoice, errors: [] } },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "OK" }) })
    mockUseLnUpdateHashPaid.mockReturnValue("different-hash")

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()
    await flushEffects()

    expect(result.current.paid).toBe(false)
    expect(result.current.errorMessage).toBe("")
    expect(result.current.lnServiceErrorReason).toBe("")
  })

  describe("pending state and payment-status polling fallback (#3564)", () => {
    const invoice = { paymentRequest: "lnbc-bolt11-string", paymentHash: "hash-A" }

    const arrangeAcceptedWithdrawal = () => {
      mockLnInvoiceCreate.mockResolvedValueOnce({
        data: { lnInvoiceCreate: { invoice, errors: [] } },
      })
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "OK" }) })
    }

    it("sets pending=true (paid=false) once the LNURL callback accepts the withdraw request", async () => {
      arrangeAcceptedWithdrawal()

      const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

      await flushEffects()
      await flushEffects()

      expect(result.current.pending).toBe(true)
      expect(result.current.paid).toBe(false)
      expect(result.current.errorMessage).toBe("")
    })

    it("clears pending and flips paid=true when the LN update hash confirms the payment", async () => {
      arrangeAcceptedWithdrawal()
      mockUseLnUpdateHashPaid.mockReturnValue("hash-A")

      const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

      await flushEffects()
      await flushEffects()

      expect(result.current.paid).toBe(true)
      expect(result.current.pending).toBe(false)
      expect(mockApolloRefetch).toHaveBeenCalledTimes(1)
    })

    it("stays pending=false when the LNURL callback rejects the request, and never starts polling", async () => {
      mockLnInvoiceCreate.mockResolvedValueOnce({
        data: { lnInvoiceCreate: { invoice, errors: [] } },
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ERROR", reason: "voucher already used" }),
      })
      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      try {
        const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

        await flushEffects()
        await flushEffects()

        await act(async () => {
          await jest.advanceTimersByTimeAsync(9_000)
        })

        expect(result.current.pending).toBe(false)
        expect(mockApolloQuery).not.toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })

    it("flips paid=true via the status poll when the websocket update never arrives (the #3564 bug)", async () => {
      arrangeAcceptedWithdrawal()
      mockApolloQuery.mockResolvedValue({
        data: { lnInvoicePaymentStatusByHash: { status: "PAID" } },
      })

      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      try {
        const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

        await flushEffects()
        await flushEffects()
        expect(result.current.pending).toBe(true)

        await act(async () => {
          await jest.advanceTimersByTimeAsync(3_000)
        })
        await flushEffects()

        expect(mockApolloQuery).toHaveBeenCalledTimes(1)
        expect(mockApolloQuery.mock.calls[0][0].variables).toEqual({
          input: { paymentHash: "hash-A" },
        })
        expect(result.current.paid).toBe(true)
        expect(result.current.pending).toBe(false)
        expect(mockApolloRefetch).toHaveBeenCalledTimes(1)
      } finally {
        jest.useRealTimers()
      }
    })

    it("keeps polling while the invoice is unpaid and stops once the poll reports PAID", async () => {
      arrangeAcceptedWithdrawal()
      mockApolloQuery
        .mockResolvedValueOnce({
          data: { lnInvoicePaymentStatusByHash: { status: "PENDING" } },
        })
        .mockResolvedValueOnce({
          data: { lnInvoicePaymentStatusByHash: { status: "PAID" } },
        })

      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      try {
        const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

        await flushEffects()
        await flushEffects()

        await act(async () => {
          await jest.advanceTimersByTimeAsync(3_000)
        })
        expect(result.current.paid).toBe(false)
        expect(result.current.pending).toBe(true)

        await act(async () => {
          await jest.advanceTimersByTimeAsync(3_000)
        })
        await flushEffects()
        expect(result.current.paid).toBe(true)
        expect(mockApolloQuery).toHaveBeenCalledTimes(2)

        await act(async () => {
          await jest.advanceTimersByTimeAsync(9_000)
        })
        expect(mockApolloQuery).toHaveBeenCalledTimes(2)
      } finally {
        jest.useRealTimers()
      }
    })

    it("survives a transient poll error and succeeds on a later tick", async () => {
      arrangeAcceptedWithdrawal()
      mockApolloQuery
        .mockRejectedValueOnce(new Error("network hiccup"))
        .mockResolvedValueOnce({
          data: { lnInvoicePaymentStatusByHash: { status: "PAID" } },
        })

      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      try {
        const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

        await flushEffects()
        await flushEffects()

        await act(async () => {
          await jest.advanceTimersByTimeAsync(3_000)
        })
        expect(result.current.paid).toBe(false)
        expect(result.current.errorMessage).toBe("")

        await act(async () => {
          await jest.advanceTimersByTimeAsync(3_000)
        })
        await flushEffects()
        expect(result.current.paid).toBe(true)
      } finally {
        jest.useRealTimers()
      }
    })

    it("ignores a stale poll response that resolves after the payment was already confirmed", async () => {
      arrangeAcceptedWithdrawal()
      let resolvePoll: (value: unknown) => void = () => {}
      mockApolloQuery.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePoll = resolve
          }),
      )

      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      try {
        const { result, rerender } = renderHook(
          (props: typeof defaultParams) => useLnurlWithdrawRedemption(props),
          { initialProps: defaultParams },
        )

        await flushEffects()
        await flushEffects()
        expect(result.current.pending).toBe(true)

        // A poll tick fires and its query stays in flight...
        await act(async () => {
          await jest.advanceTimersByTimeAsync(3_000)
        })
        expect(mockApolloQuery).toHaveBeenCalledTimes(1)

        // ...then the websocket confirms the payment first (cleanup cancels the poll)
        mockUseLnUpdateHashPaid.mockReturnValue("hash-A")
        rerender(defaultParams)
        await flushEffects()
        expect(result.current.paid).toBe(true)
        expect(mockApolloRefetch).toHaveBeenCalledTimes(1)

        // The stale response must be ignored: no extra state churn or refetches
        await act(async () => {
          resolvePoll({ data: { lnInvoicePaymentStatusByHash: { status: "PAID" } } })
          await flushEffects()
        })

        expect(result.current.paid).toBe(true)
        expect(mockApolloRefetch).toHaveBeenCalledTimes(1)
        await act(async () => {
          await jest.advanceTimersByTimeAsync(9_000)
        })
        expect(mockApolloQuery).toHaveBeenCalledTimes(1)
      } finally {
        jest.useRealTimers()
      }
    })

    it("stops polling on unmount (interval cleanup)", async () => {
      arrangeAcceptedWithdrawal()

      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      try {
        const { unmount } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

        await flushEffects()
        await flushEffects()

        unmount()

        await act(async () => {
          await jest.advanceTimersByTimeAsync(9_000)
        })
        expect(mockApolloQuery).not.toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })
  })
})
