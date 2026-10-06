import { act, renderHook } from "@testing-library/react-native"

import {
  useGivenUpWaiting,
  WAIT_TIMEOUT_MS,
} from "@app/screens/card-screen/onboarding/investment-flow/use-given-up-waiting"

describe("useGivenUpWaiting", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** A spinner with no end and no button is a dead end, so a wait this long ends. */
  it("gives up once the wait has lasted the full timeout", () => {
    const { result } = renderHook(() => useGivenUpWaiting(true))

    act(() => {
      jest.advanceTimersByTime(WAIT_TIMEOUT_MS - 1)
    })
    expect(result.current.hasGivenUp).toBe(false)

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.hasGivenUp).toBe(true)
  })

  it("never gives up while nothing is waited on", () => {
    const { result } = renderHook(() => useGivenUpWaiting(false))

    act(() => {
      jest.advanceTimersByTime(WAIT_TIMEOUT_MS)
    })

    expect(result.current.hasGivenUp).toBe(false)
  })

  /** What was waited on arrived; a later wait must start fresh rather than already
   *  given up. */
  it("drops the flag when the wait ends, and starts a later wait fresh", () => {
    const { result, rerender } = renderHook(
      ({ isWaiting }: { isWaiting: boolean }) => useGivenUpWaiting(isWaiting),
      { initialProps: { isWaiting: true } },
    )
    act(() => {
      jest.advanceTimersByTime(WAIT_TIMEOUT_MS)
    })
    expect(result.current.hasGivenUp).toBe(true)

    rerender({ isWaiting: false })
    expect(result.current.hasGivenUp).toBe(false)

    rerender({ isWaiting: true })
    act(() => {
      jest.advanceTimersByTime(WAIT_TIMEOUT_MS - 1)
    })
    expect(result.current.hasGivenUp).toBe(false)
  })

  /** Trying again is a fresh wait of the full length, not a flag flipped back. */
  it("waits the full timeout again after starting over", () => {
    const { result } = renderHook(() => useGivenUpWaiting(true))
    act(() => {
      jest.advanceTimersByTime(WAIT_TIMEOUT_MS)
    })

    act(() => {
      result.current.startOver()
    })
    expect(result.current.hasGivenUp).toBe(false)

    act(() => {
      jest.advanceTimersByTime(WAIT_TIMEOUT_MS - 1)
    })
    expect(result.current.hasGivenUp).toBe(false)

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.hasGivenUp).toBe(true)
  })
})
