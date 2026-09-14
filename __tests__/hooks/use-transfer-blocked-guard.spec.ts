import { renderHook } from "@testing-library/react-native"

const mockUseTransferGate = jest.fn()
const mockDispatch = jest.fn()
const mockResetAction = { type: "RESET" }
const mockReset = jest.fn((_arg: unknown) => mockResetAction)

jest.mock("@app/hooks/use-transfer-blocked", () => ({
  useTransferGate: () => mockUseTransferGate(),
}))

const mockNavigation = { dispatch: mockDispatch }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: (arg: unknown) => mockReset(arg) },
}))

import { useTransferBlockedGuard } from "@app/hooks/use-transfer-blocked-guard"

const NOT_BLOCKED = { isGated: false, isRegionPending: false }
const REGION_PENDING = { isGated: false, isRegionPending: true }
const BLOCKED = { isGated: true, isRegionPending: false }

describe("useTransferBlockedGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns false and does not dispatch when transfers are not blocked", () => {
    mockUseTransferGate.mockReturnValue(NOT_BLOCKED)

    const { result } = renderHook(() => useTransferBlockedGuard())

    expect(result.current).toEqual({ isGated: false, isRegionPending: false })
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("returns true and dispatches a reset to Primary when transfers are blocked", () => {
    mockUseTransferGate.mockReturnValue(BLOCKED)

    const { result } = renderHook(() => useTransferBlockedGuard())

    expect(result.current).toEqual({ isGated: true, isRegionPending: false })
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "Primary" }] })
    expect(mockDispatch).toHaveBeenCalledWith(mockResetAction)
  })

  it("reports a wait, not a block, while the region is still resolving", () => {
    mockUseTransferGate.mockReturnValue(REGION_PENDING)

    const { result } = renderHook(() => useTransferBlockedGuard())

    expect(result.current).toEqual({ isGated: false, isRegionPending: true })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("bounces only once the pending region resolves to a block", () => {
    mockUseTransferGate.mockReturnValue(REGION_PENDING)
    const { rerender } = renderHook(() => useTransferBlockedGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseTransferGate.mockReturnValue(BLOCKED)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("never bounces when the pending region resolves to no block", () => {
    mockUseTransferGate.mockReturnValue(REGION_PENDING)
    const { result, rerender } = renderHook(() => useTransferBlockedGuard())

    mockUseTransferGate.mockReturnValue(NOT_BLOCKED)
    rerender({})

    expect(result.current).toEqual({ isGated: false, isRegionPending: false })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("dispatches exactly once even after re-renders with the same blocked value", () => {
    mockUseTransferGate.mockReturnValue(BLOCKED)

    const { rerender } = renderHook(() => useTransferBlockedGuard())
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("dispatches when transfers become blocked after mount", () => {
    mockUseTransferGate.mockReturnValue(NOT_BLOCKED)
    const { rerender } = renderHook(() => useTransferBlockedGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseTransferGate.mockReturnValue(BLOCKED)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  /** The migration conversion turns the guard off so a blocked-transfer user can empty
   *  their dollar balance instead of being bounced home. */
  it("stays off and never bounces when disabled, even while blocked", () => {
    mockUseTransferGate.mockReturnValue(BLOCKED)

    const { result } = renderHook(() => useTransferBlockedGuard({ enabled: false }))

    expect(result.current).toEqual({ isGated: false, isRegionPending: false })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("stays off when disabled while the region is still resolving", () => {
    mockUseTransferGate.mockReturnValue(REGION_PENDING)

    const { result } = renderHook(() => useTransferBlockedGuard({ enabled: false }))

    expect(result.current).toEqual({ isGated: false, isRegionPending: false })
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
