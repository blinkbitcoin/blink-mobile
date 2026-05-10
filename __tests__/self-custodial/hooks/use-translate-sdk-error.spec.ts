import { renderHook } from "@testing-library/react-native"

import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import { useTranslateSdkError } from "@app/self-custodial/hooks/use-translate-sdk-error"

const insufficientFunds = jest.fn(() => "Insufficient funds")
const belowMinimum = jest.fn(() => "Below minimum")
const networkError = jest.fn(() => "Network error")
const invalidInput = jest.fn(() => "Invalid input")
const generic = jest.fn(() => "Something went wrong")

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SelfCustodialError: {
        insufficientFunds,
        belowMinimum,
        networkError,
        invalidInput,
        generic,
      },
    },
  }),
}))

describe("useTranslateSdkError", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns undefined for undefined input without calling i18n", () => {
    const { result } = renderHook(() => useTranslateSdkError())
    expect(result.current(undefined)).toBeUndefined()
    expect(insufficientFunds).not.toHaveBeenCalled()
    expect(generic).not.toHaveBeenCalled()
  })

  it("translates each known SelfCustodialErrorCode via the matching i18n key", () => {
    const { result } = renderHook(() => useTranslateSdkError())

    expect(result.current(SelfCustodialErrorCode.InsufficientFunds)).toBe(
      "Insufficient funds",
    )
    expect(insufficientFunds).toHaveBeenCalledTimes(1)

    expect(result.current(SelfCustodialErrorCode.BelowMinimum)).toBe("Below minimum")
    expect(belowMinimum).toHaveBeenCalledTimes(1)

    expect(result.current(SelfCustodialErrorCode.NetworkError)).toBe("Network error")
    expect(networkError).toHaveBeenCalledTimes(1)

    expect(result.current(SelfCustodialErrorCode.InvalidInput)).toBe("Invalid input")
    expect(invalidInput).toHaveBeenCalledTimes(1)

    expect(result.current(SelfCustodialErrorCode.Generic)).toBe("Something went wrong")
    expect(generic).toHaveBeenCalledTimes(1)
  })

  it("passes unknown strings through untouched", () => {
    const { result } = renderHook(() => useTranslateSdkError())
    expect(result.current("some_other_code")).toBe("some_other_code")
    expect(generic).not.toHaveBeenCalled()
  })
})
