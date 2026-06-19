import { renderHook } from "@testing-library/react-native"

const mockUseStableTokenTransferBlocked = jest.fn()
const mockDispatch = jest.fn()
const mockResetAction = { type: "RESET" }
const mockReset = jest.fn((_arg: unknown) => mockResetAction)

jest.mock("@app/hooks/use-stable-token-transfer-blocked", () => ({
  useStableTokenTransferBlocked: () => mockUseStableTokenTransferBlocked(),
}))

const mockNavigation = { dispatch: mockDispatch }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: (arg: unknown) => mockReset(arg) },
}))

import { useStableTokenTransferBlockedGuard } from "@app/hooks/use-stable-token-transfer-blocked-guard"

describe("useStableTokenTransferBlockedGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns false and does not dispatch when transfers are not blocked", () => {
    mockUseStableTokenTransferBlocked.mockReturnValue(false)

    const { result } = renderHook(() => useStableTokenTransferBlockedGuard())

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("returns true and dispatches a reset to Primary when transfers are blocked", () => {
    mockUseStableTokenTransferBlocked.mockReturnValue(true)

    const { result } = renderHook(() => useStableTokenTransferBlockedGuard())

    expect(result.current).toBe(true)
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "Primary" }] })
    expect(mockDispatch).toHaveBeenCalledWith(mockResetAction)
  })

  it("dispatches exactly once even after re-renders with the same blocked value", () => {
    mockUseStableTokenTransferBlocked.mockReturnValue(true)

    const { rerender } = renderHook(() => useStableTokenTransferBlockedGuard())
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("dispatches when transfers become blocked after mount", () => {
    mockUseStableTokenTransferBlocked.mockReturnValue(false)
    const { rerender } = renderHook(() => useStableTokenTransferBlockedGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseStableTokenTransferBlocked.mockReturnValue(true)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })
})
