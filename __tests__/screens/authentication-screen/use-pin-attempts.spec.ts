import { act, renderHook } from "@testing-library/react-native"

import {
  MAX_PIN_ATTEMPTS,
  readPinAttempts,
  verifyPin,
} from "@app/screens/authentication-screen/pin-verification"
import { usePinAttempts } from "@app/screens/authentication-screen/use-pin-attempts"

import { flushEffects } from "../../helpers/flush-effects"

jest.mock("@app/screens/authentication-screen/pin-verification", () => ({
  ...jest.requireActual("@app/screens/authentication-screen/pin-verification"),
  readPinAttempts: jest.fn(),
  verifyPin: jest.fn(),
}))

const mockedReadPinAttempts = jest.mocked(readPinAttempts)
const mockedVerifyPin = jest.mocked(verifyPin)

const readableState = (attempts = 0) => ({
  status: "readable" as const,
  state: { attempts },
})

const callbacks = () => ({
  onUnlocked: jest.fn(),
  onWrongPin: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks()
  mockedReadPinAttempts.mockResolvedValue(readableState())
  mockedVerifyPin.mockResolvedValue({ outcome: "unlocked" })
})

describe("usePinAttempts", () => {
  describe("the set-pin flow", () => {
    it("never reads the attempt count and never refuses input", async () => {
      const { result } = renderAttempts({ enabled: false })
      await flushEffects()

      expect(mockedReadPinAttempts).not.toHaveBeenCalled()
      expect(result.current.isInputDisabled).toBe(false)
      expect(result.current.canAcceptInput()).toBe(true)
    })
  })

  describe("hydration", () => {
    it("refuses input until the stored count has been read", async () => {
      let release: (state: ReturnType<typeof readableState>) => void = () => {}
      mockedReadPinAttempts.mockReturnValue(
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
      mockedReadPinAttempts.mockResolvedValue(readableState(2))

      const { result } = renderAttempts()
      await flushEffects()

      expect(result.current.attemptsRemaining).toBe(1)
    })

    it("reports no attempts spent on a clean slate", async () => {
      const { result } = renderAttempts()
      await flushEffects()

      expect(result.current.attemptsRemaining).toBeNull()
    })

    it("reports an unreadable count and hands the keypad back for a retry", async () => {
      mockedReadPinAttempts.mockResolvedValue({ status: "unreadable" })

      const { result, handlers } = renderAttempts()
      await flushEffects()

      expect(handlers.onUnreadable).toHaveBeenCalledTimes(1)
      expect(result.current.canAcceptInput()).toBe(true)
      expect(result.current.attemptsRemaining).toBeNull()
    })
  })

  describe("re-entrancy", () => {
    it("runs only one verification when two submits land in the same tick", async () => {
      // The backspace bypass: a second entry used to re-run the handler on a
      // stale attempt count, so two wrong guesses were recorded as one.
      let release: () => void = () => {}
      mockedVerifyPin.mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve({ outcome: "wrong", attemptsRemaining: 2 })
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
    it("reports an unlock and drops any remembered failures", async () => {
      mockedReadPinAttempts.mockResolvedValue(readableState(2))
      const { result, handlers } = renderAttempts()
      await flushEffects()

      await act(async () => {
        result.current.submit("1234")
      })

      expect(handlers.onUnlocked).toHaveBeenCalledTimes(1)
      expect(result.current.attemptsRemaining).toBeNull()
    })

    it("reports a wrong pin with the attempts left", async () => {
      mockedVerifyPin.mockResolvedValue({ outcome: "wrong", attemptsRemaining: 2 })

      const { result, handlers } = renderAttempts()
      await flushEffects()

      await act(async () => {
        result.current.submit("9999")
      })

      expect(handlers.onWrongPin).toHaveBeenCalledTimes(1)
      expect(result.current.attemptsRemaining).toBe(2)
      expect(result.current.canAcceptInput()).toBe(true)
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
    mockedReadPinAttempts.mockReturnValue(
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
    mockedReadPinAttempts.mockResolvedValue(readableState(1))
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
    expect(handlers.onWrongPin).not.toHaveBeenCalled()
    expect(handlers.onExhausted).not.toHaveBeenCalled()
    expect(result.current.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 1)
  })

  it("hands the keypad back, since a retry is what recovers from it", async () => {
    const { result } = await unreadableAfterAFailure()

    expect(result.current.isInputDisabled).toBe(false)
    expect(result.current.canAcceptInput()).toBe(true)
  })
})
