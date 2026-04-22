import { act, renderHook, waitFor } from "@testing-library/react-native"

import { BalanceMode, useBalanceMode } from "@app/hooks/use-balance-mode"

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}))

describe("useBalanceMode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
  })

  it("defaults to BTC when nothing has been persisted", async () => {
    const { result } = renderHook(() => useBalanceMode())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.mode).toBe(BalanceMode.Btc)
  })

  it("restores a previously persisted USD mode on mount", async () => {
    mockGetItem.mockResolvedValue(BalanceMode.Usd)

    const { result } = renderHook(() => useBalanceMode())

    await waitFor(() => {
      expect(result.current.mode).toBe(BalanceMode.Usd)
    })
  })

  it("ignores corrupted storage values and keeps the default", async () => {
    mockGetItem.mockResolvedValue("garbage")

    const { result } = renderHook(() => useBalanceMode())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.mode).toBe(BalanceMode.Btc)
  })

  it("persists a mode change via setMode", async () => {
    const { result } = renderHook(() => useBalanceMode())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.setMode(BalanceMode.Usd)
    })

    expect(result.current.mode).toBe(BalanceMode.Usd)
    expect(mockSetItem).toHaveBeenCalledWith("selfCustodialBalanceMode", "usd")
  })

  it("toggleMode flips BTC → USD → BTC and persists each change", async () => {
    const { result } = renderHook(() => useBalanceMode())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.toggleMode()
    })
    expect(result.current.mode).toBe(BalanceMode.Usd)
    expect(mockSetItem).toHaveBeenLastCalledWith("selfCustodialBalanceMode", "usd")

    act(() => {
      result.current.toggleMode()
    })
    expect(result.current.mode).toBe(BalanceMode.Btc)
    expect(mockSetItem).toHaveBeenLastCalledWith("selfCustodialBalanceMode", "btc")
  })

  it("survives an AsyncStorage read failure without crashing", async () => {
    mockGetItem.mockRejectedValue(new Error("storage down"))

    const { result } = renderHook(() => useBalanceMode())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.mode).toBe(BalanceMode.Btc)
  })
})
