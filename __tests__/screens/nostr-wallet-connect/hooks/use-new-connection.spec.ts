import { renderHook, act } from "@testing-library/react-native"

import { useNewConnection } from "@app/screens/nostr-wallet-connect/hooks/use-new-connection"

describe("useNewConnection", () => {
  it("has correct initial state", () => {
    const { result } = renderHook(() => useNewConnection())

    expect(result.current.appName).toBe("")
    expect(result.current.budgetConfigs).toEqual([
      { period: "DAILY", amountSatsText: "", enabled: false },
      { period: "WEEKLY", amountSatsText: "", enabled: false },
      { period: "MONTHLY", amountSatsText: "", enabled: false },
      { period: "NEVER", amountSatsText: "", enabled: false },
    ])
    expect(result.current.enabledBudgetCount).toBe(0)
    expect(result.current.budgetsForCreate).toEqual([])
    expect(result.current.permissionToggles).toEqual({
      receiveOnly: true,
      readHistory: false,
      makePayments: false,
    })
    expect(result.current.permissions).toEqual(["GET_INFO", "MAKE_INVOICE"])
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

  it("supports enabling and setting budgets for multiple periods", () => {
    const { result } = renderHook(() => useNewConnection())

    act(() => {
      result.current.setBudgetEnabled("DAILY", true)
      result.current.setBudgetAmount("WEEKLY", "25abc00")
      result.current.setBudgetEnabled("WEEKLY", true)
    })

    expect(result.current.enabledBudgetCount).toBe(2)
    expect(result.current.budgetConfigs).toEqual([
      { period: "DAILY", amountSatsText: "10000", enabled: true },
      { period: "WEEKLY", amountSatsText: "2500", enabled: true },
      { period: "MONTHLY", amountSatsText: "", enabled: false },
      { period: "NEVER", amountSatsText: "", enabled: false },
    ])
  })

  it("only includes budgets for create when make payments is enabled", () => {
    const { result } = renderHook(() => useNewConnection())

    act(() => {
      result.current.setBudgetEnabled("MONTHLY", true)
      result.current.setBudgetAmount("MONTHLY", "50000")
    })

    expect(result.current.budgetsForCreate).toEqual([])

    act(() => {
      result.current.setPermissionEnabled("makePayments", true)
    })

    expect(result.current.budgetsForCreate).toEqual([
      { amountSats: 50_000, period: "MONTHLY" },
    ])
    expect(result.current.permissions).toEqual([
      "GET_INFO",
      "MAKE_INVOICE",
      "PAY_INVOICE",
    ])
  })

  it("requires enabled budgets to be positive", () => {
    const { result } = renderHook(() => useNewConnection())

    act(() => {
      result.current.setAppName("Damus")
      result.current.setBudgetEnabled("DAILY", true)
      result.current.setBudgetAmount("DAILY", "0")
    })

    expect(result.current.isValid).toBe(false)
  })

  it("allows connecting with no budget limits", () => {
    const { result } = renderHook(() => useNewConnection())

    act(() => {
      result.current.setAppName("Damus")
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.budgetsForCreate).toEqual([])
  })

  it("maps read history to read permissions", () => {
    const { result } = renderHook(() => useNewConnection())

    act(() => {
      result.current.setPermissionEnabled("readHistory", true)
    })

    expect(result.current.permissions).toEqual([
      "GET_INFO",
      "MAKE_INVOICE",
      "GET_BALANCE",
      "LOOKUP_INVOICE",
      "LIST_TRANSACTIONS",
    ])
  })
})
