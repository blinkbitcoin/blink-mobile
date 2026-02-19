import { renderHook, act } from "@testing-library/react-hooks"
import { Alert } from "react-native"

import { useLnurlWithdraw } from "@app/screens/receive-bitcoin-screen/hooks/use-lnurl-withdraw"
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"

const mockLL = {
  RedeemBitcoinScreen: {
    error: jest.fn(() => "Error creating invoice"),
    submissionError: jest.fn(() => "Submission error"),
    redeemingError: jest.fn(() => "Redeeming error"),
  },
}

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: mockLL }),
}))

const mockFetch = jest.fn()
jest.mock("cross-fetch", () => ({
  __esModule: true,
  default: (...args: ReadonlyArray<string>) => mockFetch(...args),
}))

type MockPaymentRequest = {
  info: {
    data: {
      invoiceType: string
      paymentRequest: string
    } | null
  } | null
}

const validPr: MockPaymentRequest = {
  info: {
    data: {
      invoiceType: Invoice.Lightning,
      paymentRequest: "lnbc1test_payment_request",
    },
  },
}

const validDestination = {
  validDestination: {
    callback: "https://example.com/lnurl/withdraw",
    k1: "random_k1_value",
  },
}

describe("useLnurlWithdraw", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns a function", () => {
    const { result } = renderHook(() =>
      useLnurlWithdraw(validPr as Parameters<typeof useLnurlWithdraw>[0]),
    )

    expect(typeof result.current).toBe("function")
  })

  it("shows error when pr has no lightning data", async () => {
    const alertSpy = jest.spyOn(Alert, "alert")
    const prNoData: MockPaymentRequest = { info: { data: null } }

    const { result } = renderHook(() =>
      useLnurlWithdraw(prNoData as Parameters<typeof useLnurlWithdraw>[0]),
    )

    await act(async () => {
      await result.current(
        validDestination as Parameters<ReturnType<typeof useLnurlWithdraw>>[0],
      )
    })

    expect(alertSpy).toHaveBeenCalledWith("Error creating invoice")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("shows error when pr is null", async () => {
    const alertSpy = jest.spyOn(Alert, "alert")

    const { result } = renderHook(() => useLnurlWithdraw(null))

    await act(async () => {
      await result.current(
        validDestination as Parameters<ReturnType<typeof useLnurlWithdraw>>[0],
      )
    })

    expect(alertSpy).toHaveBeenCalledWith("Error creating invoice")
  })

  it("shows error when invoice type is not Lightning", async () => {
    const alertSpy = jest.spyOn(Alert, "alert")
    const prOnChain: MockPaymentRequest = {
      info: {
        data: {
          invoiceType: Invoice.OnChain,
          paymentRequest: "bc1qtest",
        },
      },
    }

    const { result } = renderHook(() =>
      useLnurlWithdraw(prOnChain as Parameters<typeof useLnurlWithdraw>[0]),
    )

    await act(async () => {
      await result.current(
        validDestination as Parameters<ReturnType<typeof useLnurlWithdraw>>[0],
      )
    })

    expect(alertSpy).toHaveBeenCalledWith("Error creating invoice")
  })

  it("constructs URL with k1 and pr params and fetches", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "OK" }),
    })

    const { result } = renderHook(() =>
      useLnurlWithdraw(validPr as Parameters<typeof useLnurlWithdraw>[0]),
    )

    await act(async () => {
      await result.current(
        validDestination as Parameters<ReturnType<typeof useLnurlWithdraw>>[0],
      )
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain("k1=random_k1_value")
    expect(calledUrl).toContain("pr=lnbc1test_payment_request")
  })

  it("shows submission error on non-ok response", async () => {
    const alertSpy = jest.spyOn(Alert, "alert")
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("server error"),
    })

    const { result } = renderHook(() =>
      useLnurlWithdraw(validPr as Parameters<typeof useLnurlWithdraw>[0]),
    )

    await act(async () => {
      await result.current(
        validDestination as Parameters<ReturnType<typeof useLnurlWithdraw>>[0],
      )
    })

    expect(alertSpy).toHaveBeenCalledWith("Submission error")
  })

  it("shows redeeming error when response status is not ok", async () => {
    const alertSpy = jest.spyOn(Alert, "alert")
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ERROR", reason: "Invalid k1" }),
    })

    const { result } = renderHook(() =>
      useLnurlWithdraw(validPr as Parameters<typeof useLnurlWithdraw>[0]),
    )

    await act(async () => {
      await result.current(
        validDestination as Parameters<ReturnType<typeof useLnurlWithdraw>>[0],
      )
    })

    expect(alertSpy).toHaveBeenCalledWith("Redeeming error", "Invalid k1")
  })

  it("does not alert on successful withdraw", async () => {
    const alertSpy = jest.spyOn(Alert, "alert")
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "OK" }),
    })

    const { result } = renderHook(() =>
      useLnurlWithdraw(validPr as Parameters<typeof useLnurlWithdraw>[0]),
    )

    await act(async () => {
      await result.current(
        validDestination as Parameters<ReturnType<typeof useLnurlWithdraw>>[0],
      )
    })

    expect(alertSpy).not.toHaveBeenCalled()
  })
})
