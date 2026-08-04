import { renderHook } from "@testing-library/react-native"

const mockUseDollarBalanceRestriction = jest.fn()
const mockDispatch = jest.fn()
const mockResetAction = { type: "RESET" }
const mockReset = jest.fn((_arg: unknown) => mockResetAction)

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestriction: () => mockUseDollarBalanceRestriction(),
}))

const mockNavigation = { dispatch: mockDispatch }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: (arg: unknown) => mockReset(arg) },
}))

import { useDollarBalanceRestrictionGuard } from "@app/hooks/use-dollar-balance-restriction-guard"

const UNRESTRICTED = { isRestricted: false, isRegionPending: false }
const REGION_PENDING = { isRestricted: false, isRegionPending: true }
const RESTRICTED = { isRestricted: true, isRegionPending: false }

describe("useDollarBalanceRestrictionGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns false and does not dispatch when not restricted", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(UNRESTRICTED)

    const { result } = renderHook(() => useDollarBalanceRestrictionGuard())

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("returns true and dispatches a reset to Primary when restricted", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(RESTRICTED)

    const { result } = renderHook(() => useDollarBalanceRestrictionGuard())

    expect(result.current).toBe(true)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Primary" }],
    })
    expect(mockDispatch).toHaveBeenCalledWith(mockResetAction)
  })

  it("hides the screen but never bounces while the region is still resolving", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(REGION_PENDING)

    const { result } = renderHook(() => useDollarBalanceRestrictionGuard())

    expect(result.current).toBe(true)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("bounces only once the pending region resolves to a restriction", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(REGION_PENDING)
    const { rerender } = renderHook(() => useDollarBalanceRestrictionGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseDollarBalanceRestriction.mockReturnValue(RESTRICTED)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("never bounces when the pending region resolves to no restriction", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(REGION_PENDING)
    const { result, rerender } = renderHook(() => useDollarBalanceRestrictionGuard())

    mockUseDollarBalanceRestriction.mockReturnValue(UNRESTRICTED)
    rerender({})

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("dispatches exactly once even after re-renders with the same restricted value", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(RESTRICTED)

    const { rerender } = renderHook(() => useDollarBalanceRestrictionGuard())
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("dispatches when the restriction flips to true after mount", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(UNRESTRICTED)
    const { rerender } = renderHook(() => useDollarBalanceRestrictionGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseDollarBalanceRestriction.mockReturnValue(RESTRICTED)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  /** The migration conversion turns the guard off so a restricted user can empty their
   *  dollar balance instead of being bounced home. */
  it("stays off and never bounces when disabled, even while restricted", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(RESTRICTED)

    const { result } = renderHook(() =>
      useDollarBalanceRestrictionGuard({ enabled: false }),
    )

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("stays off when disabled while the region is still resolving", () => {
    mockUseDollarBalanceRestriction.mockReturnValue(REGION_PENDING)

    const { result } = renderHook(() =>
      useDollarBalanceRestrictionGuard({ enabled: false }),
    )

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
