import { renderHook } from "@testing-library/react-native"

const mockUseDollarBalanceRestricted = jest.fn()
const mockDispatch = jest.fn()
const mockResetAction = { type: "RESET" }
const mockReset = jest.fn((_arg: unknown) => mockResetAction)

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockUseDollarBalanceRestricted(),
}))

const mockNavigation = { dispatch: mockDispatch }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: (arg: unknown) => mockReset(arg) },
}))

import { useDollarBalanceRestrictionGuard } from "@app/hooks/use-dollar-balance-restriction-guard"

describe("useDollarBalanceRestrictionGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns false and does not dispatch when not restricted", () => {
    mockUseDollarBalanceRestricted.mockReturnValue(false)

    const { result } = renderHook(() => useDollarBalanceRestrictionGuard())

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("returns true and dispatches a reset to Primary when restricted", () => {
    mockUseDollarBalanceRestricted.mockReturnValue(true)

    const { result } = renderHook(() => useDollarBalanceRestrictionGuard())

    expect(result.current).toBe(true)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Primary" }],
    })
    expect(mockDispatch).toHaveBeenCalledWith(mockResetAction)
  })

  it("dispatches exactly once even after re-renders with the same restricted value", () => {
    mockUseDollarBalanceRestricted.mockReturnValue(true)

    const { rerender } = renderHook(() => useDollarBalanceRestrictionGuard())
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("dispatches when the restriction flips to true after mount", () => {
    mockUseDollarBalanceRestricted.mockReturnValue(false)
    const { rerender } = renderHook(() => useDollarBalanceRestrictionGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseDollarBalanceRestricted.mockReturnValue(true)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  /** The migration conversion turns the guard off so a restricted user can empty their
   *  dollar balance instead of being bounced home. */
  it("stays off and never bounces when disabled, even while restricted", () => {
    mockUseDollarBalanceRestricted.mockReturnValue(true)

    const { result } = renderHook(() =>
      useDollarBalanceRestrictionGuard({ enabled: false }),
    )

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
