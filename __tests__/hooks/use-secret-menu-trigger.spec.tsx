import { act, renderHook } from "@testing-library/react-native"

import { useSecretMenuTrigger } from "@app/hooks/use-secret-menu-trigger"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

describe("useSecretMenuTrigger", () => {
  const originalDev = __DEV__
  const setDev = (value: boolean) => {
    ;(global as unknown as { __DEV__: boolean }).__DEV__ = value
  }

  beforeEach(() => {
    mockNavigate.mockClear()
  })

  afterEach(() => {
    setDev(originalDev)
  })

  const tapTimes = (times: number) => {
    const { result } = renderHook(() => useSecretMenuTrigger())
    for (let i = 0; i < times; i += 1) {
      act(() => result.current())
    }
  }

  it("navigates to the developer screen after three taps in development builds", () => {
    setDev(true)

    tapTimes(3)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("developerScreen")
  })

  it("does not navigate before the third tap in development builds", () => {
    setDev(true)

    tapTimes(2)

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("does not navigate after three taps in release builds", () => {
    setDev(false)

    tapTimes(3)

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("resets the tap count after navigating, so the next tap does not re-trigger", () => {
    setDev(true)

    tapTimes(4)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })
})
