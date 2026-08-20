import { act, renderHook } from "@testing-library/react-native"

import { MAX_PIN_ATTEMPTS } from "@app/screens/authentication-screen/pin-lockout"
import { usePinLockout } from "@app/screens/authentication-screen/use-pin-lockout"
import {
  readPinLockState,
  verifyPin,
} from "@app/screens/authentication-screen/pin-verification"

import { flushEffects } from "../../helpers/flush-effects"

jest.mock("@app/screens/authentication-screen/pin-verification", () => ({
  readPinLockState: jest.fn(),
  verifyPin: jest.fn(),
}))

const mockedReadPinLockState = jest.mocked(readPinLockState)
const mockedVerifyPin = jest.mocked(verifyPin)

const readableState = (attempts = 0, lockedUntil = 0) => ({
  status: "readable" as const,
  state: { attempts, lockedUntil },
})

const callbacks = () => ({
  onUnlocked: jest.fn(),
  onWrongPin: jest.fn(),
  onExhausted: jest.fn(),
  onUnrecorded: jest.fn(),
  onUnreadable: jest.fn(),
})

const renderLockout = (
  overrides: Partial<Parameters<typeof usePinLockout>[0]> = {},
  handlers = callbacks(),
) => {
  const result = renderHook(() =>
    usePinLockout({ enabled: true, ...handlers, ...overrides }),
  )
  return { ...result, handlers }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedReadPinLockState.mockResolvedValue(readableState())
  mockedVerifyPin.mockResolvedValue({ outcome: "unlocked" })
})

describe("usePinLockout", () => {
  describe("the set-pin flow", () => {
    it("never reads the lockout state and never locks", async () => {
      const { result } = renderLockout({ enabled: false })
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

      const { result } = renderLockout()

      expect(result.current.canAcceptInput()).toBe(false)

      await act(async () => {
        release(readableState())
      })
      await flushEffects()

      expect(result.current.canAcceptInput()).toBe(true)
    })

    it("restores how many attempts are left", async () => {
      mockedReadPinLockState.mockResolvedValue(readableState(2))

      const { result } = renderLockout()
      await flushEffects()

      expect(result.current.attemptsRemaining).toBe(1)
    })

    it("reports no attempts spent on a clean slate", async () => {
      const { result } = renderLockout()
      await flushEffects()

      expect(result.current.attemptsRemaining).toBeNull()
    })

    it("reports an unreadable state and hands the keypad back for a retry", async () => {
      mockedReadPinLockState.mockResolvedValue({ status: "unreadable" })

      const { result, handlers } = renderLockout()
      await flushEffects()

      expect(handlers.onUnreadable).toHaveBeenCalledTimes(1)
      expect(result.current.canAcceptInput()).toBe(true)
      expect(result.current.attemptsRemaining).toBeNull()
    })
  })

  describe("clock rollback", () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("re-reads the authoritative state to persist a repaired live expiry", async () => {
      const start = Date.now()
      mockedReadPinLockState
        .mockResolvedValueOnce(readableState(1, start + 30_000))
        .mockImplementation(async (now) => readableState(1, now + 30_000))

      renderLockout()
      await flushEffects()

      act(() => {
        jest.setSystemTime(start - 60 * 60 * 1000)
        jest.advanceTimersByTime(250)
      })
      await flushEffects()

      expect(mockedReadPinLockState).toHaveBeenCalledTimes(2)
      expect(mockedReadPinLockState.mock.calls[1][0]).toBeLessThan(start - 59 * 60 * 1000)
    })

    it("reports an unreadable persisted repair while the local countdown continues", async () => {
      const start = Date.now()
      mockedReadPinLockState
        .mockResolvedValueOnce(readableState(1, start + 30_000))
        .mockResolvedValueOnce({ status: "unreadable" })

      const { result, handlers } = renderLockout()
      await flushEffects()

      act(() => {
        jest.setSystemTime(start - 60 * 60 * 1000)
        jest.advanceTimersByTime(250)
      })
      await flushEffects()

      expect(handlers.onUnreadable).toHaveBeenCalledTimes(1)
      expect(result.current.remainingSeconds).toBe(30)

      await act(async () => {
        jest.advanceTimersByTime(10_000)
      })
      expect(result.current.remainingSeconds).toBe(20)
      expect(mockedReadPinLockState).toHaveBeenCalledTimes(2)
    })
  })

  describe("re-entrancy", () => {
    it("runs only one verification when two submits land in the same tick", async () => {
      // The backspace bypass: a second entry used to re-run the handler on a
      // stale attempt count, so two wrong guesses were recorded as one.
      let release: () => void = () => {}
      mockedVerifyPin.mockReturnValue(
        new Promise((resolve) => {
          release = () =>
            resolve({
              outcome: "wrong",
              attemptsRemaining: 2,
              lockedUntil: Date.now() + 30_000,
            })
        }),
      )

      const { result } = renderLockout()
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

      const { result } = renderLockout()
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

      const { result } = renderLockout({}, handlers)
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
    it("reports an unlock and drops any remembered failures", async () => {
      mockedReadPinLockState.mockResolvedValue(readableState(2))
      const { result, handlers } = renderLockout()
      await flushEffects()

      await act(async () => {
        result.current.submit("1234")
      })

      expect(handlers.onUnlocked).toHaveBeenCalledTimes(1)
      expect(result.current.attemptsRemaining).toBeNull()
    })

    it("reports a wrong pin with the attempts left and starts the countdown", async () => {
      mockedVerifyPin.mockResolvedValue({
        outcome: "wrong",
        attemptsRemaining: 2,
        lockedUntil: Date.now() + 30_000,
      })

      const { result, handlers } = renderLockout()
      await flushEffects()

      await act(async () => {
        result.current.submit("9999")
      })

      expect(handlers.onWrongPin).toHaveBeenCalledTimes(1)
      expect(result.current.attemptsRemaining).toBe(2)
      expect(result.current.isLocked).toBe(true)
    })

    it("shows the lock without spending an attempt when one was already running", async () => {
      mockedVerifyPin.mockResolvedValue({
        outcome: "locked",
        lockedUntil: Date.now() + 30_000,
      })

      const { result, handlers } = renderLockout()
      await flushEffects()

      await act(async () => {
        result.current.submit("9999")
      })

      expect(result.current.isLocked).toBe(true)
      expect(handlers.onWrongPin).not.toHaveBeenCalled()
      expect(handlers.onExhausted).not.toHaveBeenCalled()
    })

    it("reports an unrecordable attempt so the caller can fail closed", async () => {
      mockedVerifyPin.mockResolvedValue({ outcome: "unrecorded" })

      const { result, handlers } = renderLockout()
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

    const { unmount } = renderLockout()
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

    const { result, handlers } = renderLockout()
    await flushEffects()

    await act(async () => {
      result.current.submit("1234")
    })

    return { result, handlers }
  }

  it("tells the screen, and spends none of the displayed budget", async () => {
    const { result, handlers } = await unreadableAfterAFailure()

    expect(handlers.onUnreadable).toHaveBeenCalledTimes(1)
    expect(handlers.onWrongPin).not.toHaveBeenCalled()
    expect(handlers.onExhausted).not.toHaveBeenCalled()
    expect(result.current.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 1)
  })

  it("hands the keypad back, since a retry is what recovers from it", async () => {
    const { result } = await unreadableAfterAFailure()

    expect(result.current.isInputDisabled).toBe(false)
    expect(result.current.canAcceptInput()).toBe(true)
    expect(result.current.isLocked).toBe(false)
  })
})
