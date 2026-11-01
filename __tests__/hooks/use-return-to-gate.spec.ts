import { renderHook } from "@testing-library/react-native"

import { useReturnToGate } from "@app/hooks/use-return-to-gate"

const mockReset = jest.fn()
const mockSetAppLocked = jest.fn()

/** One object across renders, as the real navigation prop is. */
const mockNavigation = { reset: mockReset }

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigation,
}))

/** The lock flag's context pulls in native boot code this hook never touches; stubbing it
 *  keeps the import graph off the device APIs. */
jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppLocked: mockSetAppLocked }),
}))

describe("useReturnToGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does nothing until it is asked", () => {
    renderHook(() => useReturnToGate())

    expect(mockSetAppLocked).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("resets the stack to the gate, leaving nothing beneath it", () => {
    /** A session can end from a screen pushed on top of the live stack, and anything left
     *  beneath the gate would still be reachable. The gate, not the landing screen: a
     *  logout keeps the lock while the device still stores something it guards, and the
     *  landing screen can open an account that reaches it. */
    const { result } = renderHook(() => useReturnToGate())

    result.current()

    expect(mockReset).toHaveBeenCalledTimes(1)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "authenticationCheck" }],
    })
  })

  it("raises the lock before the gate is on screen", () => {
    /** This can run in a session that was unlocked. A gate shown with the flag down lets
     *  a payment link open over the lock screen, and the resume relock stack a second
     *  lock on top of it. */
    const { result } = renderHook(() => useReturnToGate())

    result.current()

    expect(mockSetAppLocked).toHaveBeenCalledTimes(1)
    expect(mockSetAppLocked.mock.invocationCallOrder[0]).toBeLessThan(
      mockReset.mock.invocationCallOrder[0],
    )
  })

  it("hands back the same function across renders, so it can sit in a dependency list", () => {
    const { result, rerender } = renderHook(() => useReturnToGate())
    const first = result.current

    rerender({})

    expect(result.current).toBe(first)
  })
})
