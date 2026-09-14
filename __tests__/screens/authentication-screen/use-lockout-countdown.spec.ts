import { act, renderHook } from "@testing-library/react-native"

import { useLockoutCountdown } from "@app/screens/authentication-screen/use-lockout-countdown"

import { flushEffects } from "../../helpers/flush-effects"

describe("useLockoutCountdown", () => {
  beforeEach(() => {
    // flushEffects relies on setImmediate; keep it real so effects settle.
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const advance = async (ms: number) => {
    await flushEffects()
    await act(async () => {
      jest.advanceTimersByTime(ms)
    })
    await flushEffects()
  }

  it("reports no lock when there is none", () => {
    const { result } = renderHook(() => useLockoutCountdown(0))

    expect(result.current.isLocked).toBe(false)
    expect(result.current.remainingSeconds).toBe(0)
  })

  it("reports the remaining seconds straight away, without waiting a tick", () => {
    const lockedUntil = Date.now() + 30_000
    const { result } = renderHook(() => useLockoutCountdown(lockedUntil))

    expect(result.current.isLocked).toBe(true)
    expect(result.current.remainingSeconds).toBe(30)
  })

  it("counts down as time passes", async () => {
    const lockedUntil = Date.now() + 30_000
    const { result } = renderHook(() => useLockoutCountdown(lockedUntil))

    await advance(10_000)

    expect(result.current.remainingSeconds).toBe(20)
  })

  it("repairs a live expiry once when the wall clock moves backward", async () => {
    const start = Date.now()
    const onLockedUntilRepaired = jest.fn()
    const { result } = renderHook(() =>
      useLockoutCountdown(start + 30_000, onLockedUntilRepaired),
    )

    await advance(5_000)
    expect(result.current.remainingSeconds).toBe(25)

    act(() => {
      jest.setSystemTime(start - 60 * 60 * 1000)
    })
    await advance(250)

    expect(onLockedUntilRepaired).toHaveBeenCalledTimes(1)
    expect(result.current.remainingSeconds).toBe(30)

    await advance(10_000)
    expect(result.current.remainingSeconds).toBe(20)

    await advance(20_000)
    expect(result.current.isLocked).toBe(false)
  })

  it("keeps the lock up, and the label off zero, in the final part-second", async () => {
    // Flooring here would both unlock early and render "try again in 0s" for a
    // whole second while the keypad was still dead.
    const lockedUntil = Date.now() + 30_000
    const { result } = renderHook(() => useLockoutCountdown(lockedUntil))

    await advance(29_999)

    expect(result.current.isLocked).toBe(true)
    expect(result.current.remainingSeconds).toBe(1)
  })

  it("lifts the lock once the moment arrives, and not before", async () => {
    const lockedUntil = Date.now() + 30_000
    const { result } = renderHook(() => useLockoutCountdown(lockedUntil))

    await advance(30_000)

    expect(result.current.isLocked).toBe(false)
    expect(result.current.remainingSeconds).toBe(0)
  })

  it("resyncs immediately when a new lock is set", async () => {
    const start = Date.now()
    const { result, rerender } = renderHook(
      ({ lockedUntil }: { lockedUntil: number }) => useLockoutCountdown(lockedUntil),
      { initialProps: { lockedUntil: start + 10_000 } },
    )

    rerender({ lockedUntil: start + 30_000 })

    expect(result.current.remainingSeconds).toBe(30)
  })

  it("stops ticking once the lock has elapsed", async () => {
    const lockedUntil = Date.now() + 1_000
    let renders = 0
    renderHook(() => {
      renders += 1
      return useLockoutCountdown(lockedUntil)
    })

    await advance(1_500)
    const rendersAtExpiry = renders

    await advance(60_000)

    expect(renders).toBe(rendersAtExpiry)
  })

  it("schedules nothing at all when there is no lock", () => {
    renderHook(() => useLockoutCountdown(0))

    expect(jest.getTimerCount()).toBe(0)
  })

  it("clears its interval on unmount", () => {
    const lockedUntil = Date.now() + 30_000
    const { unmount } = renderHook(() => useLockoutCountdown(lockedUntil))
    expect(jest.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(jest.getTimerCount()).toBe(0)
  })
})
