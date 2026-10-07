import { useLayoutEffect } from "react"
import { act, renderHook } from "@testing-library/react-native"

import { useLockoutCountdown } from "@app/screens/authentication-screen/use-lockout-countdown"

import { flushEffects } from "../../helpers/flush-effects"

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS

/** The second failure is the one that waits thirty seconds. */
const SECOND_FAILURE = 2
const SECOND_FAILURE_WAIT_MS = 30 * SECOND_MS

type Lock = { attempts: number; lockedUntil: number }

const NO_LOCK: Lock = { attempts: 0, lockedUntil: 0 }

const ignoreRepair = () => {}

describe("useLockoutCountdown", () => {
  beforeEach(() => {
    // flushEffects relies on setImmediate; keep it real so effects settle.
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  const advance = async (ms: number) => {
    await flushEffects()
    await act(async () => {
      jest.advanceTimersByTime(ms)
    })
    await flushEffects()
  }

  /** A lock as the second failure writes it: thirty seconds from now. */
  const secondFailureLock = (): Lock => ({
    attempts: SECOND_FAILURE,
    lockedUntil: Date.now() + SECOND_FAILURE_WAIT_MS,
  })

  const renderCountdown = (
    lock: Lock,
    onRepaired: (now: number) => void = ignoreRepair,
  ) =>
    renderHook((current: Lock) => useLockoutCountdown(current, onRepaired), {
      initialProps: lock,
    })

  it("reports no lock when there is none", () => {
    const { result } = renderCountdown(NO_LOCK)

    expect(result.current.isLocked).toBe(false)
    expect(result.current.remainingSeconds).toBe(0)
  })

  it("reports the remaining seconds straight away, without waiting a tick", () => {
    const { result } = renderCountdown(secondFailureLock())

    expect(result.current.isLocked).toBe(true)
    expect(result.current.remainingSeconds).toBe(30)
  })

  it("counts down as time passes", async () => {
    const { result } = renderCountdown(secondFailureLock())

    await advance(10 * SECOND_MS)

    expect(result.current.remainingSeconds).toBe(20)
  })

  it("counts the long waits past the attempt budget in full", async () => {
    const { result } = renderCountdown({
      attempts: 6,
      lockedUntil: Date.now() + 60 * MINUTE_MS,
    })

    expect(result.current.remainingSeconds).toBe(3600)

    await advance(59 * MINUTE_MS)

    expect(result.current.isLocked).toBe(true)
    expect(result.current.remainingSeconds).toBe(60)
  })

  it("repairs a live expiry once when the wall clock moves backward", async () => {
    const start = Date.now()
    const onLockedUntilRepaired = jest.fn()
    const { result } = renderCountdown(
      { attempts: SECOND_FAILURE, lockedUntil: start + SECOND_FAILURE_WAIT_MS },
      onLockedUntilRepaired,
    )

    await advance(5 * SECOND_MS)
    expect(result.current.remainingSeconds).toBe(25)

    const steppedBack = start - 60 * MINUTE_MS
    act(() => {
      jest.setSystemTime(steppedBack)
    })
    await advance(250)

    expect(onLockedUntilRepaired).toHaveBeenCalledTimes(1)
    expect(onLockedUntilRepaired).toHaveBeenCalledWith(steppedBack + 250)
    expect(result.current.remainingSeconds).toBe(30)

    await advance(10 * SECOND_MS)
    expect(result.current.remainingSeconds).toBe(20)

    await advance(20 * SECOND_MS)
    expect(result.current.isLocked).toBe(false)
  })

  it("bounds a repaired lock by the wait of its own failure, not by the longest one", async () => {
    /** The first failure waits ten seconds. A clock stepping back an hour under it must
     *  cost ten seconds again, never the hour the schedule keeps for the sixth failure. */
    const start = Date.now()
    const { result } = renderCountdown({
      attempts: 1,
      lockedUntil: start + 10 * SECOND_MS,
    })

    act(() => {
      jest.setSystemTime(start - 60 * MINUTE_MS)
    })
    await advance(250)

    expect(result.current.remainingSeconds).toBe(10)
  })

  it("keeps the lock up, and the label off zero, in the final part-second", async () => {
    // Flooring here would both unlock early and render a zero for a whole
    // second while the keypad was still dead.
    const { result } = renderCountdown(secondFailureLock())

    await advance(SECOND_FAILURE_WAIT_MS - 1)

    expect(result.current.isLocked).toBe(true)
    expect(result.current.remainingSeconds).toBe(1)
  })

  it("lifts the lock once the moment arrives, and not before", async () => {
    const { result } = renderCountdown(secondFailureLock())

    await advance(SECOND_FAILURE_WAIT_MS)

    expect(result.current.isLocked).toBe(false)
    expect(result.current.remainingSeconds).toBe(0)
  })

  describe("a lock that arrives with a render", () => {
    /** Every frame React commits, in order: what a keypad reading the hook is shown. */
    const renderRecordingCommits = (initial: Lock) => {
      const committed: Array<{ isLocked: boolean; remainingSeconds: number }> = []
      const rendered = renderHook(
        (lock: Lock) => {
          const { isLocked, remainingSeconds } = useLockoutCountdown(lock, ignoreRepair)
          useLayoutEffect(() => {
            committed.push({ isLocked, remainingSeconds })
          })
          return { isLocked, remainingSeconds }
        },
        { initialProps: initial },
      )
      return { ...rendered, committed }
    }

    it("is never committed as unlocked first", () => {
      /** A frame that still reported no lock would leave the keypad live for as long as
       *  it was on screen, and a digit tapped into it stays for the whole wait. */
      const { rerender, committed } = renderRecordingCommits(NO_LOCK)
      committed.length = 0

      rerender(secondFailureLock())

      expect(committed.length).toBeGreaterThan(0)
      expect(committed.every((frame) => frame.isLocked)).toBe(true)
      expect(committed.every((frame) => frame.remainingSeconds === 30)).toBe(true)
    })

    it("is never committed with the countdown of the lock before it", () => {
      const start = Date.now()
      const { rerender, committed } = renderRecordingCommits({
        attempts: 1,
        lockedUntil: start + 10 * SECOND_MS,
      })
      committed.length = 0

      rerender({ attempts: SECOND_FAILURE, lockedUntil: start + SECOND_FAILURE_WAIT_MS })

      expect(committed.every((frame) => frame.remainingSeconds === 30)).toBe(true)
    })
  })

  it("settles on a lock whose numbers are not numbers, rather than rendering without end", () => {
    /** The store never hands one out, but this is the lock screen: a render loop here is
     *  an app nobody can open. */
    const { result } = renderCountdown({ attempts: Number.NaN, lockedUntil: Number.NaN })

    expect(result.current.isLocked).toBe(false)
  })

  it("keeps its interval for a new object carrying the same lock", async () => {
    /** Callers pass the state they hold, which can be a new object on any render. The
     *  countdown follows the two numbers in it, so the same lock is the same countdown. */
    const start = Date.now()
    const lock = { attempts: SECOND_FAILURE, lockedUntil: start + SECOND_FAILURE_WAIT_MS }
    const { result, rerender } = renderCountdown(lock)
    await advance(10 * SECOND_MS)
    const clearIntervalSpy = jest.spyOn(global, "clearInterval")
    const setIntervalSpy = jest.spyOn(global, "setInterval")

    rerender({ ...lock })

    expect(clearIntervalSpy).not.toHaveBeenCalled()
    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(result.current.remainingSeconds).toBe(20)
  })

  it("counts the same lock again on request, after a clock that moved back revived it", async () => {
    /** The countdown ran out and stopped. The clock then steps back to before the expiry,
     *  so the stored lock is in force again while the countdown still reads zero. Nothing
     *  about the lock changed, so only an explicit resync can start it counting. */
    const start = Date.now()
    const onLockedUntilRepaired = jest.fn()
    const { result } = renderCountdown(
      { attempts: 1, lockedUntil: start + 10 * SECOND_MS },
      onLockedUntilRepaired,
    )
    await advance(10 * SECOND_MS)
    expect(result.current.isLocked).toBe(false)

    act(() => {
      jest.setSystemTime(start + 4 * SECOND_MS)
    })
    expect(result.current.isLocked).toBe(false)

    act(() => {
      result.current.resync()
    })

    expect(result.current.isLocked).toBe(true)
    expect(result.current.remainingSeconds).toBe(6)

    await advance(6 * SECOND_MS)
    expect(result.current.isLocked).toBe(false)
  })

  it("renders when the second it shows changes, not on every tick", async () => {
    /** It ticks four times a second so the keypad comes back on time, and the wait can
     *  last an hour: a render per tick would redraw the whole screen for all of it. */
    let renders = 0
    const lock = secondFailureLock()
    renderHook(() => {
      renders += 1
      return useLockoutCountdown(lock, ignoreRepair)
    })
    await flushEffects()
    const rendersAtStart = renders

    await advance(250)
    await advance(250)
    await advance(250)
    expect(renders).toBe(rendersAtStart)

    await advance(250)
    expect(renders).toBe(rendersAtStart + 1)
  })

  it("stops ticking once the lock has elapsed", async () => {
    let renders = 0
    const lock = { attempts: 1, lockedUntil: Date.now() + SECOND_MS }
    renderHook(() => {
      renders += 1
      return useLockoutCountdown(lock, ignoreRepair)
    })

    await advance(1_500)
    const rendersAtExpiry = renders

    await advance(60 * SECOND_MS)

    expect(renders).toBe(rendersAtExpiry)
  })

  it("schedules nothing at all when there is no lock", () => {
    renderCountdown(NO_LOCK)

    expect(jest.getTimerCount()).toBe(0)
  })

  it("clears its interval on unmount", () => {
    const { unmount } = renderCountdown(secondFailureLock())
    expect(jest.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(jest.getTimerCount()).toBe(0)
  })
})
