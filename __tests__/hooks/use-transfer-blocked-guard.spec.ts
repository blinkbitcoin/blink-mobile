import { renderHook } from "@testing-library/react-native"

const mockUseTransferBlocked = jest.fn()
const mockDispatch = jest.fn()
const mockResetAction = { type: "RESET" }
const mockReset = jest.fn((_arg: unknown) => mockResetAction)

jest.mock("@app/hooks/use-transfer-blocked", () => ({
  useTransferBlocked: () => mockUseTransferBlocked(),
}))

const mockNavigation = { dispatch: mockDispatch }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: (arg: unknown) => mockReset(arg) },
}))

import { useTransferBlockedGuard } from "@app/hooks/use-transfer-blocked-guard"

describe("useTransferBlockedGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns false and does not dispatch when transfers are not blocked", () => {
    mockUseTransferBlocked.mockReturnValue(false)

    const { result } = renderHook(() => useTransferBlockedGuard())

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("returns true and dispatches a reset to Primary when transfers are blocked", () => {
    mockUseTransferBlocked.mockReturnValue(true)

    const { result } = renderHook(() => useTransferBlockedGuard())

    expect(result.current).toBe(true)
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "Primary" }] })
    expect(mockDispatch).toHaveBeenCalledWith(mockResetAction)
  })

  it("dispatches exactly once even after re-renders with the same blocked value", () => {
    mockUseTransferBlocked.mockReturnValue(true)

    const { rerender } = renderHook(() => useTransferBlockedGuard())
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("dispatches when transfers become blocked after mount", () => {
    mockUseTransferBlocked.mockReturnValue(false)
    const { rerender } = renderHook(() => useTransferBlockedGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseTransferBlocked.mockReturnValue(true)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  /** The migration conversion turns the guard off so a blocked-transfer user can empty
   *  their dollar balance instead of being bounced home. */
  it("stays off and never bounces when disabled, even while blocked", () => {
    mockUseTransferBlocked.mockReturnValue(true)

    const { result } = renderHook(() => useTransferBlockedGuard({ enabled: false }))

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
