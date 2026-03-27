import { renderHook, act } from "@testing-library/react-native"

import { useNewConnection } from "@app/screens/nostr-wallet-connect/hooks/use-new-connection"

describe("useNewConnection", () => {
  it("has correct initial state", () => {
    const { result } = renderHook(() => useNewConnection())

    expect(result.current.appName).toBe("")
    expect(result.current.dailyBudgetSats).toBe(10_000)
    expect(result.current.isValid).toBe(false)
  })

  it("setAppName updates the app name", () => {
    const { result } = renderHook(() => useNewConnection())

    act(() => {
      result.current.setAppName("Amethyst")
    })

    expect(result.current.appName).toBe("Amethyst")
  })

  it("isValid is false when appName is empty or whitespace", () => {
    const { result } = renderHook(() => useNewConnection())

    expect(result.current.isValid).toBe(false)

    act(() => {
      result.current.setAppName("   ")
    })

    expect(result.current.isValid).toBe(false)
  })

  it("isValid is true when appName has non-whitespace content", () => {
    const { result } = renderHook(() => useNewConnection())

    act(() => {
      result.current.setAppName("Damus")
    })

    expect(result.current.isValid).toBe(true)
  })

  it("selectBudget updates dailyBudgetSats", () => {
    const { result } = renderHook(() => useNewConnection())

    act(() => {
      result.current.selectBudget(100_000)
    })

    expect(result.current.dailyBudgetSats).toBe(100_000)
  })
})
