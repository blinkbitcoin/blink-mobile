import { act, renderHook, waitFor } from "@testing-library/react-native"

import { useStableBalanceFirstTime } from "@app/hooks/use-stable-balance-first-time"

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}))

describe("useStableBalanceFirstTime", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetItem.mockResolvedValue(undefined)
  })

  it("exposes shouldShow=true when AsyncStorage has no record", async () => {
    mockGetItem.mockResolvedValue(null)
    const { result } = renderHook(() => useStableBalanceFirstTime())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.shouldShow).toBe(true)
  })

  it("exposes shouldShow=false when AsyncStorage has the 'true' flag", async () => {
    mockGetItem.mockResolvedValue("true")
    const { result } = renderHook(() => useStableBalanceFirstTime())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.shouldShow).toBe(false)
  })

  it("flips shouldShow to false after markAsShown and persists the flag", async () => {
    mockGetItem.mockResolvedValue(null)
    const { result } = renderHook(() => useStableBalanceFirstTime())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.markAsShown()
    })

    expect(result.current.shouldShow).toBe(false)
    expect(mockSetItem).toHaveBeenCalledWith("stableBalanceExplanationShown", "true")
  })

  it("does not claim shouldShow=true while still loading (race guard)", async () => {
    mockGetItem.mockResolvedValue(null)
    const { result, unmount } = renderHook(() => useStableBalanceFirstTime())

    expect(result.current.loaded).toBe(false)
    expect(result.current.shouldShow).toBe(false)

    unmount()
  })

  it("survives AsyncStorage read failure without crashing and stays hidden", async () => {
    mockGetItem.mockRejectedValue(new Error("storage down"))
    const { result } = renderHook(() => useStableBalanceFirstTime())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    // Fail-closed: if we cannot read storage we keep the modal hidden to avoid
    // surprising the user on every launch.
    expect(result.current.shouldShow).toBe(false)
  })
})
