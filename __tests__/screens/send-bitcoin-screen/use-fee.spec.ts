import { renderHook, waitFor } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import useFee from "@app/screens/send-bitcoin-screen/use-fee"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import { toBtcMoneyAmount } from "@app/types/amounts"

// use-fee only calls these to hand them to getFee; the self-custodial quotes ignore them.
// The tuple is built once and shared: it lands in the fee effect's dependency array, so a
// fresh identity per render would re-fire the effect forever (Apollo's is stable for real).
jest.mock("@app/graphql/generated", () => {
  const probe = [jest.fn(), {}]
  return {
    WalletCurrency: { Btc: "BTC", Usd: "USD" },
    useLnInvoiceFeeProbeMutation: () => probe,
    useLnNoAmountInvoiceFeeProbeMutation: () => probe,
    useLnUsdInvoiceFeeProbeMutation: () => probe,
    useLnNoAmountUsdInvoiceFeeProbeMutation: () => probe,
    useOnChainTxFeeLazyQuery: () => probe,
    useOnChainUsdTxFeeLazyQuery: () => probe,
    useOnChainUsdTxFeeAsBtcDenominatedLazyQuery: () => probe,
  }
})

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: jest.fn(),
}))

const classifiedError = (message: string) => ({
  __typename: "GraphQLApplicationError" as const,
  message,
})

/** `errors` only exists on the non-"set" arms of FeeType, so narrow before reading it. */
const asErrored = (fee: ReturnType<typeof useFee>) => {
  if (fee.status !== "error")
    throw new Error(`expected an errored fee, got ${fee.status}`)
  return fee
}

describe("useFee", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("stays unset when there is no getFee function", () => {
    const { result } = renderHook(() => useFee(undefined))

    expect(result.current.status).toBe("unset")
  })

  it("sets the quoted amount on success", async () => {
    const getFee = jest.fn().mockResolvedValue({ amount: toBtcMoneyAmount(42) })

    const { result } = renderHook(() => useFee(getFee))

    await waitFor(() => {
      expect(result.current.status).toBe("set")
    })
    expect(result.current.amount?.amount).toBe(42)
  })

  // The classified code is the whole point of the plumbing: the confirmation screen reads
  // it off this state to name the cause instead of showing its generic dead-end string.
  it("threads the errors from a failed quote into the error state", async () => {
    const getFee = jest.fn().mockResolvedValue({
      amount: undefined,
      errors: [classifiedError(SelfCustodialErrorCode.InsufficientFunds)],
    })

    const { result } = renderHook(() => useFee(getFee))

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })
    expect(asErrored(result.current).errors?.[0]?.message).toBe(
      SelfCustodialErrorCode.InsufficientFunds,
    )
  })

  it("threads errors through even when the quote still carries an amount", async () => {
    const getFee = jest.fn().mockResolvedValue({
      amount: toBtcMoneyAmount(7),
      errors: [classifiedError("max fee only")],
    })

    const { result } = renderHook(() => useFee(getFee))

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })
    expect(result.current.amount?.amount).toBe(7)
    expect(asErrored(result.current).errors?.[0]?.message).toBe("max fee only")
  })

  it("leaves errors undefined when the quote fails without a classified code", async () => {
    const getFee = jest.fn().mockResolvedValue({ amount: undefined })

    const { result } = renderHook(() => useFee(getFee))

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })
    expect(asErrored(result.current).errors).toBeUndefined()
  })

  it("reports and errors without a code when getFee itself throws", async () => {
    const getFee = jest.fn().mockRejectedValue(new Error("quote exploded"))

    const { result } = renderHook(() => useFee(getFee))

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })
    expect(asErrored(result.current).errors).toBeUndefined()
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "quote exploded" }),
    )
  })

  it("passes the settlement currency generic through untouched", async () => {
    const usdFee = { amount: 5, currency: WalletCurrency.Usd, currencyCode: "USD" }
    const getFee = jest.fn().mockResolvedValue({ amount: usdFee })

    const { result } = renderHook(() => useFee(getFee))

    await waitFor(() => {
      expect(result.current.status).toBe("set")
    })
    expect(result.current.amount?.currency).toBe(WalletCurrency.Usd)
  })
})
