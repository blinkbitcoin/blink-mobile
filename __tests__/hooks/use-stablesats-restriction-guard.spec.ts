import { renderHook } from "@testing-library/react-native"

const mockUseStablesatsRestricted = jest.fn()
const mockDispatch = jest.fn()
const mockResetAction = { type: "RESET" }
const mockReset = jest.fn((_arg: unknown) => mockResetAction)

jest.mock("@app/hooks/use-stablesats-restricted", () => ({
  useStablesatsRestricted: () => mockUseStablesatsRestricted(),
}))

const mockNavigation = { dispatch: mockDispatch }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: (arg: unknown) => mockReset(arg) },
}))

import { useStablesatsRestrictionGuard } from "@app/hooks/use-stablesats-restriction-guard"

describe("useStablesatsRestrictionGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns false and does not dispatch when not restricted", () => {
    mockUseStablesatsRestricted.mockReturnValue(false)

    const { result } = renderHook(() => useStablesatsRestrictionGuard())

    expect(result.current).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("returns true and dispatches a reset to Primary when restricted", () => {
    mockUseStablesatsRestricted.mockReturnValue(true)

    const { result } = renderHook(() => useStablesatsRestrictionGuard())

    expect(result.current).toBe(true)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Primary" }],
    })
    expect(mockDispatch).toHaveBeenCalledWith(mockResetAction)
  })

  it("dispatches exactly once even after re-renders with the same restricted value", () => {
    mockUseStablesatsRestricted.mockReturnValue(true)

    const { rerender } = renderHook(() => useStablesatsRestrictionGuard())
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("dispatches when the restriction flips to true after mount", () => {
    mockUseStablesatsRestricted.mockReturnValue(false)
    const { rerender } = renderHook(() => useStablesatsRestrictionGuard())

    expect(mockDispatch).not.toHaveBeenCalled()

    mockUseStablesatsRestricted.mockReturnValue(true)
    rerender({})

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })
})
