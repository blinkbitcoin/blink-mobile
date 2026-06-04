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
const mockLnInvoiceCreate = jest.fn()
const mockApolloRefetch = jest.fn()
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

jest.mock("@apollo/client", () => {
  const actual = jest.requireActual("@apollo/client")
  return {
    ...actual,
    useApolloClient: () => ({ refetchQueries: mockApolloRefetch }),
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

  it("does not run the SC adapter when lnurlWithdraw is unavailable (SDK still loading)", async () => {
    mockUsePayments.mockReturnValue({
      accountType: AccountType.SelfCustodial,
      lnurlWithdraw: undefined,
    })

    const { result } = renderHook(() => useLnurlWithdrawRedemption(defaultParams))

    await flushEffects()

    expect(mockLnurlWithdraw).not.toHaveBeenCalled()
    expect(result.current.paid).toBe(false)
    expect(result.current.errorMessage).toBe("")
  })

  it("sets paid=true when the SC adapter resolves with Success", async () => {
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

  it("sets the translated SDK error code when the SC adapter resolves Failed", async () => {
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

  it("aborts the SC AbortController on unmount", async () => {
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

  it("ignores the SC Failed branch when the hook unmounts before the adapter resolves (cancellation guard)", async () => {
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
})
