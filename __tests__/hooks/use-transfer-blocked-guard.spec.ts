import { renderHook } from "@testing-library/react-native"

const mockUseTransferBlock = jest.fn()
const mockDispatch = jest.fn()
const mockResetAction = { type: "RESET" }
const mockReset = jest.fn((_arg: unknown) => mockResetAction)

jest.mock("@app/hooks/use-transfer-blocked", () => ({
  useTransferBlock: () => mockUseTransferBlock(),
}))

const mockNavigation = { dispatch: mockDispatch }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: (arg: unknown) => mockReset(arg) },
}))

import { useTransferBlockedGuard } from "@app/hooks/use-transfer-blocked-guard"

const NOT_BLOCKED = { isBlocked: false, isRegionPending: false }
const REGION_PENDING = { isBlocked: false, isRegionPending: true }
const BLOCKED = { isBlocked: true, isRegionPending: false }

describe("useTransferBlockedGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns false and does not dispatch when transfers are not blocked", () => {
    mockUseTransferBlock.mockReturnValue(NOT_BLOCKED)

    const { result } = renderHook(() => useTransferBlockedGuard())

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("returns true and dispatches a reset to Primary when transfers are blocked", () => {
    mockUseTransferBlock.mockReturnValue(BLOCKED)

    const { result } = renderHook(() => useTransferBlockedGuard())

    expect(result.current).toBe(true)
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "Primary" }] })
    expect(mockDispatch).toHaveBeenCalledWith(mockResetAction)
  })

  it("hides the screen but never bounces while the region is still resolving", () => {
    mockUseTransferBlock.mockReturnValue(REGION_PENDING)

    const { result } = renderHook(() => useTransferBlockedGuard())

    expect(result.current).toBe(true)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("bounces only once the pending region resolves to a block", () => {
    mockUseTransferBlock.mockReturnValue(REGION_PENDING)
    const { rerender } = renderHook(() => useTransferBlockedGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseTransferBlock.mockReturnValue(BLOCKED)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("never bounces when the pending region resolves to no block", () => {
    mockUseTransferBlock.mockReturnValue(REGION_PENDING)
    const { result, rerender } = renderHook(() => useTransferBlockedGuard())

    mockUseTransferBlock.mockReturnValue(NOT_BLOCKED)
    rerender({})

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("dispatches exactly once even after re-renders with the same blocked value", () => {
    mockUseTransferBlock.mockReturnValue(BLOCKED)

    const { rerender } = renderHook(() => useTransferBlockedGuard())
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("dispatches when transfers become blocked after mount", () => {
    mockUseTransferBlock.mockReturnValue(NOT_BLOCKED)
    const { rerender } = renderHook(() => useTransferBlockedGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseTransferBlock.mockReturnValue(BLOCKED)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  /** The migration conversion turns the guard off so a blocked-transfer user can empty
   *  their dollar balance instead of being bounced home. */
  it("stays off and never bounces when disabled, even while blocked", () => {
    mockUseTransferBlock.mockReturnValue(BLOCKED)

    const { result } = renderHook(() => useTransferBlockedGuard({ enabled: false }))

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("stays off when disabled while the region is still resolving", () => {
    mockUseTransferBlock.mockReturnValue(REGION_PENDING)

    const { result } = renderHook(() => useTransferBlockedGuard({ enabled: false }))

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
