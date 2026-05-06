import { renderHook, act, waitFor } from "@testing-library/react-native"

import { useTrustModelSeen } from "@app/screens/spark-onboarding/trust-model-screen"

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
}))

describe("useTrustModelSeen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
  })

  it("defaults to seen=false and loaded=false before loading", () => {
    const { result } = renderHook(() => useTrustModelSeen())

    expect(result.current.seen).toBe(false)
    expect(result.current.loaded).toBe(false)
  })

  it("loads false and sets loaded when not persisted", async () => {
    mockGetItem.mockResolvedValue(null)

    const { result } = renderHook(() => useTrustModelSeen())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.seen).toBe(false)
  })

  it("loads true when persisted", async () => {
    mockGetItem.mockResolvedValue("true")

    const { result } = renderHook(() => useTrustModelSeen())

    await waitFor(() => {
      expect(result.current.seen).toBe(true)
    })
    expect(result.current.loaded).toBe(true)
  })

  it("persists seen state on markAsSeen", async () => {
    mockGetItem.mockResolvedValue(null)

    const { result } = renderHook(() => useTrustModelSeen())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    await act(async () => {
      result.current.markAsSeen()
    })

    expect(result.current.seen).toBe(true)
    expect(mockSetItem).toHaveBeenCalledWith("trustModelSeen", "true")
  })

  it("sets loaded=true even when getItem rejects", async () => {
    mockGetItem.mockRejectedValue(new Error("storage error"))

    const { result } = renderHook(() => useTrustModelSeen())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.seen).toBe(false)
  })
})
