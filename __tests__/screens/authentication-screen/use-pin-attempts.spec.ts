import { useLayoutEffect } from "react"
import { it } from "@jest/globals"
import { act, renderHook } from "@testing-library/react-native"

import {
  MAX_PIN_ATTEMPTS,
  readPinLockState,
  verifyPin,
} from "@app/screens/authentication-screen/pin-verification"
import { usePinAttempts } from "@app/screens/authentication-screen/use-pin-attempts"

import { flushEffects } from "../../helpers/flush-effects"

jest.mock("@app/screens/authentication-screen/pin-verification", () => ({
  ...jest.requireActual("@app/screens/authentication-screen/pin-verification"),
  readPinLockState: jest.fn(),
  verifyPin: jest.fn(),
}))

const mockedReadPinLockState = jest.mocked(readPinLockState)
const mockedVerifyPin = jest.mocked(verifyPin)

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS

const readableState = (attempts = 0, lockedUntil = 0) => ({
  status: "readable" as const,
  state: { attempts, lockedUntil },
})

/** The state the first wrong entry leaves: one failure, and its ten-second wait. */
const firstFailure = () => ({ attempts: 1, lockedUntil: Date.now() + 10 * SECOND_MS })

const callbacks = () => ({
  onUnlocked: jest.fn(),
  onRejected: jest.fn(),
  onExhausted: jest.fn(),
  onUnrecorded: jest.fn(),
  onUnreadable: jest.fn(),
})

const renderAttempts = (
  overrides: Partial<Parameters<typeof usePinAttempts>[0]> = {},
  handlers = callbacks(),
) => {
  const result = renderHook(() =>
    usePinAttempts({ enabled: true, ...handlers, ...overrides }),
  )
  return { ...result, handlers }
}

/** The hook, with every frame React commits recorded in order: what a keypad wired to
 *  `isInputDisabled` is actually shown, including frames a test reading only the latest
 *  result never sees. */
const renderRecordingCommits = (handlers = callbacks()) => {
  const committedDisabled: boolean[] = []
  const rendered = renderHook(() => {
    const attempts = usePinAttempts({ enabled: true, ...handlers })
    const { isInputDisabled } = attempts
    useLayoutEffect(() => {
      committedDisabled.push(isInputDisabled)
    })
    return attempts
  })
  return { ...rendered, handlers, committedDisabled }
}

const advance = async (ms: number) => {
  await flushEffects()
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
  await flushEffects()
}

beforeEach(() => {
  jest.clearAllMocks()
  // The countdown ticks on an interval and reads the clock. flushEffects relies
  // on setImmediate; keep it real so effects settle.
  jest.useFakeTimers({ doNotFake: ["setImmediate"] })
  mockedReadPinLockState.mockResolvedValue(readableState())
  mockedVerifyPin.mockResolvedValue({ outcome: "unlocked" })
})

afterEach(() => {
  jest.useRealTimers()
})

describe("usePinAttempts", () => {
  describe("the set-pin flow", () => {
    it("never reads the failure state, never locks and never refuses input", async () => {
      const { result } = renderAttempts({ enabled: false })
      await flushEffects()

      expect(mockedReadPinLockState).not.toHaveBeenCalled()
      expect(result.current.isLocked).toBe(false)
      expect(result.current.isInputDisabled).toBe(false)
      expect(result.current.canAcceptInput()).toBe(true)
    })
  })

  describe("hydration", () => {
    it("refuses input until the stored state has been read", async () => {
      let release: (state: ReturnType<typeof readableState>) => void = () => {}
      mockedReadPinLockState.mockReturnValue(
        new Promise((resolve) => {
          release = resolve
        }),
      )

      const { result } = renderAttempts()

      expect(result.current.canAcceptInput()).toBe(false)

      await act(async () => {
        release(readableState())
      })
      await flushEffects()

      expect(result.current.canAcceptInput()).toBe(true)
    })

    it("restores how many attempts are left", async () => {
      mockedReadPinLockState.mockResolvedValue(readableState(2))

      const { result } = renderAttempts()
      await flushEffects()

      expect(result.current.attemptsRemaining).toBe(1)
    })

    it("does not call a count it came back to an entry rejected here", async () => {
      /** The failures were made before this screen was mounted: on an earlier launch, or
       *  on a challenge elsewhere. Nobody typed a wrong PIN on this one yet. */
      mockedReadPinLockState.mockResolvedValue(readableState(2))

      const { result } = renderAttempts()
      await flushEffects()

      expect(result.current.hasRejectedEntry).toBe(false)
    })

    /** A lock that outlives the logout it triggered keeps its spent count, and every
     *  round after that adds one to it, so the count climbs past the budget. Whatever it
     *  has reached, nothing is left of the budget, and nothing is not a negative number. */
    it.each([MAX_PIN_ATTEMPTS, MAX_PIN_ATTEMPTS + 1, MAX_PIN_ATTEMPTS + 3])(
      "reports nothing left of the budget for a stored count of %i",
      async (stored) => {
        mockedReadPinLockState.mockResolvedValue(readableState(stored))

        const { result } = renderAttempts()
        await flushEffects()

        expect(result.current.attemptsRemaining).toBe(0)
      },
    )

    it("reports no attempts spent on a clean slate", async () => {
      const { result } = renderAttempts()
      await flushEffects()

      expect(result.current.attemptsRemaining).toBeNull()
    })

    it("reports an unreadable state and hands the keypad back for a retry", async () => {
      mockedReadPinLockState.mockResolvedValue({ status: "unreadable" })

      const { result, handlers } = renderAttempts()
      await flushEffects()

      expect(handlers.onUnreadable).toHaveBeenCalledTimes(1)
      expect(result.current.canAcceptInput()).toBe(true)
      expect(result.current.attemptsRemaining).toBeNull()
    })

    it("restores a lock that is still running, countdown included", async () => {
      // The relaunch bypass at the level of what the user sees: a force-quit
      // must come back to a keypad that is still shut.
      const { attempts, lockedUntil } = firstFailure()
      mockedReadPinLockState.mockResolvedValue(readableState(attempts, lockedUntil))

      const { result } = renderAttempts()
      await flushEffects()

      expect(result.current.isLocked).toBe(true)
      expect(result.current.remainingSeconds).toBe(10)
      expect(result.current.isInputDisabled).toBe(true)
      expect(result.current.canAcceptInput()).toBe(false)
    })

    it("never shows a live keypad on the way back into a running lock", async () => {
      /** Not yet read, the keypad is shut. Read and locked, it is shut. No frame in
       *  between may be the one that is read and not yet counting its lock. */
      const { attempts, lockedUntil } = firstFailure()
      mockedReadPinLockState.mockResolvedValue(readableState(attempts, lockedUntil))

      const { committedDisabled } = renderRecordingCommits()
      await flushEffects()

      expect(committedDisabled.length).toBeGreaterThan(1)
      expect(committedDisabled).not.toContain(false)
    })

    it("restores the long waits past the budget too", async () => {
      const lockedUntil = Date.now() + 5 * MINUTE_MS
      mockedReadPinLockState.mockResolvedValue(readableState(4, lockedUntil))

      const { result } = renderAttempts()
      await flushEffects()

      expect(result.current.isLocked).toBe(true)
      expect(result.current.remainingSeconds).toBe(300)
      expect(result.current.attemptsRemaining).toBe(0)
    })
  })

  describe("the lock", () => {
    it("hands the keypad back once its wait is over", async () => {
      const { attempts, lockedUntil } = firstFailure()
      mockedReadPinLockState.mockResolvedValue(readableState(attempts, lockedUntil))
      const { result } = renderAttempts()
      await flushEffects()

      await advance(10 * SECOND_MS)

      expect(result.current.isLocked).toBe(false)
      expect(result.current.canAcceptInput()).toBe(true)
    })

    it("shuts the keypad after a wrong entry, for the wait that entry started", async () => {
      mockedVerifyPin.mockResolvedValue({ outcome: "wrong", state: firstFailure() })
      const { result, handlers } = renderAttempts()
      await flushEffects()

      await act(async () => {
        result.current.submit("9999")
      })

      expect(handlers.onRejected).toHaveBeenCalledTimes(1)
      expect(result.current.hasRejectedEntry).toBe(true)
      expect(result.current.attemptsRemaining).toBe(2)
      expect(result.current.isLocked).toBe(true)
      expect(result.current.remainingSeconds).toBe(10)
      expect(result.current.canAcceptInput()).toBe(false)
    })

    it("never shows a live keypad between a wrong entry and the wait it starts", async () => {
      /** A digit tapped into such a frame would stay for the whole wait, backspace being
       *  shut with the rest, and complete a guess nobody meant once the wait was over. */
      mockedVerifyPin.mockResolvedValue({ outcome: "wrong", state: firstFailure() })
      const { result, committedDisabled } = renderRecordingCommits()
      await flushEffects()
      committedDisabled.length = 0

      await act(async () => {
        result.current.submit("9999")
      })

      expect(committedDisabled.length).toBeGreaterThan(0)
      expect(committedDisabled).not.toContain(false)
      expect(result.current.isLocked).toBe(true)
    })

    it("counts a lock again when the store says it is still in force after it ran out here", async () => {
      /** The countdown ran out and stopped, then the clock stepped back to before the
       *  expiry. The store refuses the entry with the very state the hook already holds,
       *  so nothing changes for the countdown to react to: it has to be told. Left alone
       *  the keypad would look live and swallow every entry in silence. */
      const start = Date.now()
      const lock = { attempts: 1, lockedUntil: start + 10 * SECOND_MS }
      mockedReadPinLockState.mockResolvedValue(
        readableState(lock.attempts, lock.lockedUntil),
      )
      const { result, handlers } = renderAttempts()
      await flushEffects()
      await advance(10 * SECOND_MS)
      expect(result.current.isLocked).toBe(false)

      act(() => {
        jest.setSystemTime(start + 4 * SECOND_MS)
      })
      mockedVerifyPin.mockResolvedValue({ outcome: "locked", state: lock })
      await act(async () => {
        result.current.submit("1234")
      })

      expect(handlers.onRejected).toHaveBeenCalledTimes(1)
      expect(result.current.isLocked).toBe(true)
      expect(result.current.remainingSeconds).toBe(6)
      expect(result.current.canAcceptInput()).toBe(false)
    })

    it("takes a lock it had not caught up with, and gives the entry back empty", async () => {
      /** The stored lock is the authority. An entry that reaches it while it runs was not
       *  compared, so nothing was rejected, but the digits must go: left in place, they
       *  would fill the entry and leave the keypad dead once the wait was over. */
      const lockedUntil = Date.now() + 30 * SECOND_MS
      mockedVerifyPin.mockResolvedValue({
        outcome: "locked",
        state: { attempts: 2, lockedUntil },
      })
      const { result, handlers } = renderAttempts()
      await flushEffects()

      await act(async () => {
        result.current.submit("1234")
      })

      expect(handlers.onRejected).toHaveBeenCalledTimes(1)
      expect(result.current.hasRejectedEntry).toBe(false)
      expect(result.current.attemptsRemaining).toBe(1)
      expect(result.current.isLocked).toBe(true)
      expect(result.current.remainingSeconds).toBe(30)
    })

    it("reads the state again, at the stepped-back instant, when the wall clock moves backward", async () => {
      const start = Date.now()
      mockedReadPinLockState.mockResolvedValue(readableState(1, start + 10 * SECOND_MS))
      const { result } = renderAttempts()
      await flushEffects()
      mockedReadPinLockState.mockClear()

      const steppedBack = start - 60 * MINUTE_MS
      mockedReadPinLockState.mockResolvedValue(
        readableState(1, steppedBack + 10 * SECOND_MS),
      )
      act(() => {
        jest.setSystemTime(steppedBack)
      })
      await advance(250)

      /** Read again through the one reader that also repairs what is stored, so the next
       *  submit or relaunch does not impose the full wait a second time. What that reader
       *  does to storage is its own spec; here it only has to be asked, for the right now. */
      expect(mockedReadPinLockState).toHaveBeenCalledTimes(1)
      expect(mockedReadPinLockState).toHaveBeenCalledWith(steppedBack + 250)
      expect(result.current.isLocked).toBe(true)
      expect(result.current.remainingSeconds).toBe(10)

      await advance(10 * SECOND_MS)
      expect(result.current.isLocked).toBe(false)
    })

    it("tells the screen when the repair cannot read the state", async () => {
      const start = Date.now()
      mockedReadPinLockState.mockResolvedValue(readableState(1, start + 10 * SECOND_MS))
      const { result, handlers } = renderAttempts()
      await flushEffects()

      mockedReadPinLockState.mockResolvedValue({ status: "unreadable" })
      act(() => {
        jest.setSystemTime(start - 60 * MINUTE_MS)
      })
      await advance(250)

      expect(handlers.onUnreadable).toHaveBeenCalledTimes(1)
      /** The countdown keeps its own repaired expiry, so the keypad still comes back. */
      expect(result.current.isLocked).toBe(true)
      await advance(10 * SECOND_MS)
      expect(result.current.isLocked).toBe(false)
    })
  })

  describe("re-entrancy", () => {
    it("runs only one verification when two submits land in the same tick", async () => {
      // The backspace bypass: a second entry used to re-run the handler on a
      // stale attempt count, so two wrong guesses were recorded as one.
      let release: () => void = () => {}
      mockedVerifyPin.mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve({ outcome: "wrong", state: firstFailure() })
        }),
      )

      const { result } = renderAttempts()
      await flushEffects()

      act(() => {
        result.current.submit("1111")
        result.current.submit("2222")
      })

      expect(mockedVerifyPin).toHaveBeenCalledTimes(1)

      await act(async () => {
        release()
      })
    })

    it("refuses input for the whole time a verification is in flight", async () => {
      let release: () => void = () => {}
      mockedVerifyPin.mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve({ outcome: "unlocked" })
        }),
      )

      const { result } = renderAttempts()
      await flushEffects()

      act(() => {
        result.current.submit("1111")
      })

      // Ref-backed, so this is already false without waiting for a re-render.
      expect(result.current.canAcceptInput()).toBe(false)

      await act(async () => {
        release()
      })
    })

    it("keeps refusing input across the logout that follows a spent budget", async () => {
      let finishLogout: () => void = () => {}
      const handlers = callbacks()
      handlers.onExhausted.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishLogout = resolve
          }),
      )
      mockedVerifyPin.mockResolvedValue({ outcome: "exhausted" })

      const { result } = renderAttempts({}, handlers)
      await flushEffects()

      await act(async () => {
        result.current.submit("1111")
      })

      expect(handlers.onExhausted).toHaveBeenCalledTimes(1)
      expect(result.current.canAcceptInput()).toBe(false)

      await act(async () => {
        finishLogout()
      })
    })
  })

  describe("reporting outcomes", () => {
    it("reports an unlock and drops the remembered failures with their lock", async () => {
      mockedReadPinLockState.mockResolvedValue(readableState(2))
      const { result, handlers } = renderAttempts()
      await flushEffects()

      await act(async () => {
        result.current.submit("1234")
      })

      expect(handlers.onUnlocked).toHaveBeenCalledTimes(1)
      expect(result.current.attemptsRemaining).toBeNull()
      expect(result.current.hasRejectedEntry).toBe(false)
      expect(result.current.isLocked).toBe(false)
    })

    it("reports a wrong pin with the attempts left", async () => {
      mockedVerifyPin.mockResolvedValue({ outcome: "wrong", state: firstFailure() })

      const { result, handlers } = renderAttempts()
      await flushEffects()

      await act(async () => {
        result.current.submit("9999")
      })

      expect(handlers.onRejected).toHaveBeenCalledTimes(1)
      expect(result.current.attemptsRemaining).toBe(2)
    })

    it("reports an unrecordable attempt so the caller can fail closed", async () => {
      mockedVerifyPin.mockResolvedValue({ outcome: "unrecorded" })

      const { result, handlers } = renderAttempts()
      await flushEffects()

      await act(async () => {
        result.current.submit("9999")
      })

      expect(handlers.onUnrecorded).toHaveBeenCalledTimes(1)
    })
  })

  it("does not update state when the screen is gone before hydration finishes", async () => {
    let release: (state: ReturnType<typeof readableState>) => void = () => {}
    mockedReadPinLockState.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    const warn = jest.spyOn(console, "error").mockImplementation(() => {})

    const { unmount } = renderAttempts()
    unmount()

    await act(async () => {
      release(readableState(1))
    })

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("when the stored pin could not be read", () => {
  const unreadableAfterAFailure = async () => {
    mockedReadPinLockState.mockResolvedValue(readableState(1))
    mockedVerifyPin.mockResolvedValue({ outcome: "unreadable" })

    const { result, handlers } = renderAttempts()
    await flushEffects()

    await act(async () => {
      result.current.submit("1234")
    })

    return { result, handlers }
  }

  it("tells the screen, and spends none of the displayed budget", async () => {
    const { result, handlers } = await unreadableAfterAFailure()

    expect(handlers.onUnreadable).toHaveBeenCalledTimes(1)
    expect(handlers.onRejected).not.toHaveBeenCalled()
    expect(handlers.onExhausted).not.toHaveBeenCalled()
    expect(result.current.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 1)
  })

  it("hands the keypad back, since a retry is what recovers from it", async () => {
    const { result } = await unreadableAfterAFailure()

    expect(result.current.isInputDisabled).toBe(false)
    expect(result.current.canAcceptInput()).toBe(true)
  })
})
