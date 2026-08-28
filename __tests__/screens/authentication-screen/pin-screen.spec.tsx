import React from "react"
import { Alert, BackHandler } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { PinScreen } from "@app/screens/authentication-screen/pin-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { PinScreenPurpose } from "@app/utils/enum"
import { RouteProp } from "@react-navigation/native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { MAX_LOCKOUT_MS } from "@app/screens/authentication-screen/pin-lockout"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

const mockReset = jest.fn()
const mockGoBack = jest.fn()
const mockSetAppUnlocked = jest.fn()
const mockAddListener = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    reset: mockReset,
    goBack: mockGoBack,
    addListener: mockAddListener,
  }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

const mockLogout = jest.fn()

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getPin: jest.fn(),
    getPinFailureState: jest.fn(),
    setPinFailureState: jest.fn(),
    clearPinFailureState: jest.fn(),
    setPin: jest.fn(),
    /** Read by the account registry the screen renders under. */
    getSessionProfiles: jest.fn(),
  },
}))

const CORRECT_PIN = "1234"
const WRONG_PIN = "9999"

const mockedStore = jest.mocked(KeyStoreWrapper)

/**
 * A real keystore rather than per-call stubs, because the lockout now re-reads
 * storage on every attempt. Keeping the values here lets a test unmount and
 * re-render the screen to model a force-quit and relaunch.
 */
let stored: { pin: string | null; attempts: number; lockedUntil: number }

const primeStore = () => {
  stored = { pin: CORRECT_PIN, attempts: 0, lockedUntil: 0 }

  mockedStore.getPin.mockImplementation(async () => stored.pin)
  mockedStore.getPinFailureState.mockImplementation(async () => ({
    status: "found",
    state: { attempts: stored.attempts, lockedUntil: stored.lockedUntil },
  }))
  mockedStore.setPinFailureState.mockImplementation(async ({ attempts, lockedUntil }) => {
    stored.attempts = attempts
    stored.lockedUntil = lockedUntil
    return true
  })
  mockedStore.clearPinFailureState.mockImplementation(async () => {
    stored.attempts = 0
    stored.lockedUntil = 0
    return true
  })
  mockedStore.setPin.mockResolvedValue(true)
  mockedStore.getSessionProfiles.mockResolvedValue([])
}

type ChallengeCallbacks = {
  onChallengeSuccess?: () => void
  onChallengeFailure?: () => void
}

const buildRoute = (
  isResume?: boolean,
  screenPurpose: PinScreenPurpose = PinScreenPurpose.AuthenticatePin,
  callbacks: ChallengeCallbacks = {},
): RouteProp<RootStackParamList, "pin"> =>
  ({
    key: "pin",
    name: "pin",
    params: { screenPurpose, isResume, ...callbacks },
  }) as RouteProp<RootStackParamList, "pin">

const renderScreen = (
  isResume?: boolean,
  screenPurpose?: PinScreenPurpose,
  callbacks?: ChallengeCallbacks,
) =>
  render(
    <ContextForScreen>
      <PinScreen route={buildRoute(isResume, screenPurpose, callbacks)} />
    </ContextForScreen>,
  )

let backHandlerSpy: jest.SpyInstance

/** Runs whatever the screen registered for the hardware back press, and reports whether it
 *  swallowed it. Nothing registered means the press falls through to the navigator. */
const pressBack = () => {
  const registration = backHandlerSpy.mock.calls.find(
    ([eventName]) => eventName === "hardwareBackPress",
  )
  return registration?.[1]() ?? false
}

/** Runs whatever the screen registered for beforeRemove with the removing action's
 *  type — POP for gesture/header back and the screen's own goBack, GO_BACK for the
 *  hardware button, RESET for stack-wide resets the screen doesn't own. */
const fireBeforeRemove = (actionType = "POP") => {
  const registration = mockAddListener.mock.calls.find(
    ([eventName]) => eventName === "beforeRemove",
  )
  registration?.[1]({ data: { action: { type: actionType } } })
}

/** The decline callback is deferred a tick past the removing pop's dispatch. */
const flushDeferredDecline = () =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })

const enterPin = async (pin: string) => {
  for (const digit of pin.split("")) {
    fireEvent.press(screen.getByText(digit))
  }
  await flushEffects()
}

describe("PinScreen", () => {
  beforeAll(() => {
    // ContextForScreen's TypesafeI18n serves from loadedLocales; without this
    // every LL string renders as "" and text assertions are vacuous.
    loadLocale("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    primeStore()
    mockAddListener.mockReturnValue(jest.fn())
    backHandlerSpy = jest.spyOn(BackHandler, "addEventListener")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("refusing dismissal while the lock is up", () => {
    it("swallows the back press when the lock was pushed by a resume", async () => {
      /** The resume lock sits on top of the screen the user was on, so a back press would
       *  otherwise pop it and reveal the app without a challenge. */
      renderScreen(true)
      await flushEffects()

      expect(pressBack()).toBe(true)
    })

    it("leaves the back press alone on a cold start, which has nothing behind it", async () => {
      renderScreen(false)
      await flushEffects()

      expect(pressBack()).toBe(false)
    })

    it("leaves the back press alone while a pin is being created from settings", async () => {
      /** Same screen, no lock: swallowing the press here would strand the user, since the
       *  screen carries no header to go back with. */
      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      expect(pressBack()).toBe(false)
    })
  })

  it("steps back into the screen the user left when the lock came from a resume", async () => {
    renderScreen(true)
    await flushEffects()

    await enterPin(CORRECT_PIN)

    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("opens the home screen on a cold start", async () => {
    renderScreen(false)
    await flushEffects()

    await enterPin(CORRECT_PIN)

    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Primary" }],
    })
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("treats a missing resume flag as a cold start", async () => {
    renderScreen(undefined)
    await flushEffects()

    await enterPin(CORRECT_PIN)

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Primary" }],
    })
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("keeps a wrong pin on the lock, resuming nothing", async () => {
    renderScreen(true)
    await flushEffects()

    await enterPin(WRONG_PIN)

    expect(mockSetAppUnlocked).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  describe("the dismiss control", () => {
    /** The screen carries no header, so without this the only ways out are the
     *  edge swipe and the hardware back — neither of which is visible. */
    it("is absent on the app lock, which must offer no way out", async () => {
      renderScreen(true)
      await flushEffects()

      expect(screen.queryByTestId("pinScreenDismiss")).toBeNull()
    })

    it("is absent on a cold-start unlock too", async () => {
      renderScreen(false)
      await flushEffects()

      expect(screen.queryByTestId("pinScreenDismiss")).toBeNull()
    })

    it("leaves the set-pin flow when pressed", async () => {
      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      fireEvent.press(screen.getByTestId("pinScreenDismiss"))

      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("leaves a challenge when pressed, which the caller reads as a decline", async () => {
      /** The goBack dispatches a POP, and the beforeRemove listener turns that
       *  into the decline — the same path a swipe takes. */
      renderScreen(undefined, PinScreenPurpose.ChallengePin, {
        onChallengeSuccess: jest.fn(),
        onChallengeFailure: jest.fn(),
      })
      await flushEffects()

      fireEvent.press(screen.getByTestId("pinScreenDismiss"))

      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("is announced, not just tappable", async () => {
      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      expect(screen.getByLabelText("Back")).toBeTruthy()
    })
  })

  describe("ChallengePin: verifying the pin for a caller without touching the app lock", () => {
    const renderChallenge = (callbacks: ChallengeCallbacks) =>
      renderScreen(undefined, PinScreenPurpose.ChallengePin, callbacks)

    it("resolves the challenge and steps back on the correct pin, never unlocking the app", async () => {
      const onChallengeSuccess = jest.fn()
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure })
      await flushEffects()

      await enterPin(CORRECT_PIN)

      expect(onChallengeSuccess).toHaveBeenCalledTimes(1)
      expect(onChallengeFailure).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).toHaveBeenCalled()
      expect(mockGoBack).toHaveBeenCalledTimes(1)
      /** The load-bearing assertions: a challenge must never masquerade as the app unlock. */
      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()
    })

    it("shows a label so the challenge isn't a bare keypad over arbitrary content", async () => {
      renderChallenge({})
      await flushEffects()

      expect(screen.getByText("Enter your PIN code")).toBeTruthy()
    })

    it("does not report failure when the pop after success fires beforeRemove", async () => {
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      await enterPin(CORRECT_PIN)
      fireBeforeRemove()
      await flushDeferredDecline()

      expect(onChallengeFailure).not.toHaveBeenCalled()
    })

    it("treats dismissal as a decline, exactly once", async () => {
      const onChallengeSuccess = jest.fn()
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure })
      await flushEffects()

      fireBeforeRemove()
      fireBeforeRemove()
      await flushDeferredDecline()

      expect(onChallengeFailure).toHaveBeenCalledTimes(1)
      expect(onChallengeSuccess).not.toHaveBeenCalled()
    })

    it("defers the decline callback until the removing pop has settled", async () => {
      /** The listener runs inside the pop's dispatch; a goBack the caller issues
       *  synchronously in response coalesces with that pop and is swallowed,
       *  stranding the caller on its pending screen (found live: the backup
       *  screen sat on its spinner forever after a decline). */
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      fireBeforeRemove()

      expect(onChallengeFailure).not.toHaveBeenCalled()

      await flushDeferredDecline()

      expect(onChallengeFailure).toHaveBeenCalledTimes(1)
    })

    it("treats the hardware back as a decline too", async () => {
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      fireBeforeRemove("GO_BACK")
      await flushDeferredDecline()

      expect(onChallengeFailure).toHaveBeenCalledTimes(1)
    })

    it("stays silent when a stack-wide reset removes the challenge", async () => {
      /** A reset (migration blocker, resume relock, the lockout's own logout)
       *  unmounts the caller too — a decline callback would toast and goBack
       *  into a screen that no longer exists. */
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      fireBeforeRemove("RESET")
      await flushDeferredDecline()

      expect(onChallengeFailure).not.toHaveBeenCalled()
    })

    it("a reset resolves the challenge: a pop arriving after it reports nothing", async () => {
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      fireBeforeRemove("RESET")
      fireBeforeRemove("POP")
      await flushDeferredDecline()

      expect(onChallengeFailure).not.toHaveBeenCalled()
    })

    it("leaves the back press alone, so dismissal stays possible", async () => {
      renderChallenge({})
      await flushEffects()

      expect(pressBack()).toBe(false)
    })

    it("counts a wrong pin against the shared attempts counter and stays up", async () => {
      const onChallengeSuccess = jest.fn()
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure })
      await flushEffects()

      await enterPin(WRONG_PIN)

      /** One budget for both purposes: a challenge cannot be a free guessing
       *  channel against the pin that protects the whole app. */
      expect(stored.attempts).toBe(1)
      expect(onChallengeSuccess).not.toHaveBeenCalled()
      expect(onChallengeFailure).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()
    })

    it("refuses a guess while the shared lockout from an earlier screen still runs", async () => {
      stored.attempts = 1
      stored.lockedUntil = Date.now() + 10_000

      const onChallengeSuccess = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure: jest.fn() })
      await flushEffects()

      await enterPin(CORRECT_PIN)

      expect(onChallengeSuccess).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    it("still resets the stack when the lockout's logout fails", async () => {
      /** The reset is the lockout's terminal answer; a logout error must not
       *  strand the caller behind a challenge that can no longer resolve. */
      mockLogout.mockRejectedValueOnce(new Error("network down"))
      stored.attempts = 2

      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure: jest.fn() })
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "Primary" }],
      })
    })

    it("ignores input typed during the lockout's logout window", async () => {
      /** The lockout awaits logout + a grace sleep before resetting the stack. The
       *  keypad must be dead in that window: a correct pin typed there would
       *  otherwise resolve the challenge against a session being destroyed. */
      let releaseLogout!: () => void
      mockLogout.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          releaseLogout = resolve
        }),
      )
      stored.attempts = 2

      const onChallengeSuccess = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure: jest.fn() })
      await flushEffects()

      await enterPin(WRONG_PIN)
      await enterPin(CORRECT_PIN)

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(onChallengeSuccess).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()

      releaseLogout()
    })

    describe("after the shared lockout elapses", () => {
      beforeEach(() => {
        // flushEffects relies on setImmediate; keep it real so effects settle.
        jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      })

      afterEach(() => {
        jest.useRealTimers()
      })

      it("re-arms the keypad after a wrong guess, so the next attempt can resolve", async () => {
        const onChallengeSuccess = jest.fn()
        renderChallenge({ onChallengeSuccess, onChallengeFailure: jest.fn() })
        await flushEffects()

        await enterPin(WRONG_PIN)
        expect(stored.attempts).toBe(1)

        await flushEffects()
        await act(async () => {
          jest.advanceTimersByTime(MAX_LOCKOUT_MS + 1000)
        })
        await flushEffects()

        await enterPin(CORRECT_PIN)

        expect(onChallengeSuccess).toHaveBeenCalledTimes(1)
        expect(mockGoBack).toHaveBeenCalledTimes(1)
      })

      it("answers the third wrong guess the way the app lock does: logout and reset", async () => {
        /** The budget is the one the app lock enforces. Merely failing the challenge
         *  at the cap would hand out a fresh guess per re-entry — an unbounded brute
         *  force against the pin that protects the whole app. */
        stored.attempts = 2
        const onChallengeSuccess = jest.fn()
        const onChallengeFailure = jest.fn()
        renderChallenge({ onChallengeSuccess, onChallengeFailure })
        await flushEffects()

        await enterPin(WRONG_PIN)

        expect(mockLogout).toHaveBeenCalledTimes(1)
        await act(async () => {
          jest.advanceTimersByTime(1000) // the screen sleeps 1s before resetting
        })
        await flushEffects()

        expect(mockReset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: "Primary" }],
        })
        /** The reset unmounts the caller; a failure callback into it would be noise. */
        expect(onChallengeSuccess).not.toHaveBeenCalled()
        expect(onChallengeFailure).not.toHaveBeenCalled()
      })
    })
  })

  describe("brute-force lockout", () => {
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

    it("persists the attempt and the lockout before showing the result", async () => {
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockedStore.setPinFailureState).toHaveBeenCalledTimes(1)
      expect(stored.attempts).toBe(1)
      expect(stored.lockedUntil).toBeGreaterThan(Date.now())
    })

    it("shows how many attempts are left alongside the countdown", async () => {
      // The countdown used to replace this line, so a single typo read as
      // "too many failed attempts" and hid the real count.
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(screen.getByText("Incorrect PIN. 2 attempts remaining.")).toBeTruthy()
      expect(screen.getByText(/try again in/i)).toBeTruthy()
    })

    it("makes the keypad inert while locked, even for the correct pin", async () => {
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)
      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
      expect(screen.getByText(/try again in/i)).toBeTruthy()
    })

    it("re-enables the keypad after the lockout elapses and clears both keys on success", async () => {
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)
      await advance(11_000)

      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(mockedStore.clearPinFailureState).toHaveBeenCalled()
      expect(stored).toMatchObject({ attempts: 0, lockedUntil: 0 })
    })

    it("starts locked when a future lockout is persisted (survives relaunch)", async () => {
      stored.lockedUntil = Date.now() + 10_000

      renderScreen(false)
      await flushEffects()

      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
      expect(screen.getByText(/try again in/i)).toBeTruthy()
    })

    it("warns about the last attempt after a relaunch, not just in session", async () => {
      // The warning used to live in component state, so relaunching lost it and
      // the next wrong entry wiped the pin and session without notice.
      stored.attempts = 2

      renderScreen(false)
      await flushEffects()

      expect(screen.getByText("Incorrect PIN. 1 attempt remaining.")).toBeTruthy()
    })

    it("clamps an absurd persisted lockout and repairs it in storage", async () => {
      // A wall clock rolled backward after the write must not lock forever, and
      // leaving the bad value stored would re-impose the lock on every launch.
      stored.lockedUntil = Date.now() + 100 * 24 * 60 * 60 * 1000

      renderScreen(false)
      await flushEffects()
      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith(
        expect.objectContaining({ lockedUntil: expect.any(Number) }),
      )

      await advance(MAX_LOCKOUT_MS + 1000)
      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    })

    it("still logs out on the third failure", async () => {
      stored.attempts = 2

      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockLogout).toHaveBeenCalledTimes(1)
      await advance(1000) // the screen sleeps 1s before resetting navigation
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "Primary" }],
      })
    })

    it("logs out rather than let an attempt go unrecorded", async () => {
      // A lockout held only in memory dies with the process, so a failed write
      // has to end the session instead of leaving the next guess free.
      mockedStore.setPinFailureState.mockResolvedValue(false)

      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(screen.queryByText(/try again in/i)).toBeNull()
      expect(
        screen.getByText("Couldn't record the failed attempt securely. Logging out."),
      ).toBeTruthy()
    })

    it("invites a retry, and spends no budget, when the stored pin cannot be read", async () => {
      // A keystore fault is not a wrong entry. Scoring it as one would log the
      // user out and wipe their pin after three unlucky unlocks.
      stored.pin = null
      stored.attempts = 1

      renderScreen(false)
      await flushEffects()

      await enterPin(CORRECT_PIN)

      expect(screen.getByText("Couldn't check your PIN. Please try again.")).toBeTruthy()
      expect(screen.getByText("Incorrect PIN. 2 attempts remaining.")).toBeTruthy()
      expect(stored.attempts).toBe(1)
      expect(mockLogout).not.toHaveBeenCalled()
      expect(screen.queryByText(/try again in/i)).toBeNull()
      expect(screen.getByText("1")).not.toBeDisabled()
    })

    it("refuses a guess made on a fresh mount while the stored lock still runs", async () => {
      // The relaunch bypass: the screen's own state starts at zero attempts and
      // no lock, so a guess entered before hydration used to skip the lock and
      // write the attempt count back down to 1.
      stored.attempts = 2
      stored.lockedUntil = Date.now() + 25_000

      renderScreen(false)
      await enterPin(WRONG_PIN)

      expect(stored.attempts).toBe(2)
      expect(mockLogout).not.toHaveBeenCalled()
    })

    it("reaches the logout even when the app is killed between every guess", async () => {
      // Each guess lands in a freshly mounted screen that has hydrated nothing,
      // and the attacker has to sit out each lock. The budget still runs out.
      for (const { attempt, lockMs } of [
        { attempt: 1, lockMs: 11_000 },
        { attempt: 2, lockMs: 31_000 },
      ]) {
        const { unmount } = renderScreen(false)
        await flushEffects()
        await enterPin(WRONG_PIN)
        expect(stored.attempts).toBe(attempt)
        unmount()
        await advance(lockMs)
      }

      renderScreen(false)
      await flushEffects()
      await enterPin(WRONG_PIN)

      expect(mockLogout).toHaveBeenCalledTimes(1)
    })

    it("never locks the set-pin flow", async () => {
      stored.lockedUntil = Date.now() + 10_000

      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      await enterPin("1111")
      await enterPin("1111")

      expect(mockedStore.setPin).toHaveBeenCalledWith("1111")
      expect(mockGoBack).toHaveBeenCalled()
    })
  })

  describe("SetPin: creating a pin from settings", () => {
    it("re-arms after a mismatch so the user can start over", async () => {
      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      await enterPin("1111")
      await enterPin("2222")

      expect(mockedStore.setPin).not.toHaveBeenCalled()

      await enterPin("3333")
      await enterPin("3333")

      expect(mockedStore.setPin).toHaveBeenCalledWith("3333")
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("explains a failed store and re-arms for another try", async () => {
      mockedStore.setPin.mockResolvedValueOnce(false)
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {})

      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      await enterPin("1111")
      await enterPin("1111")

      expect(alertSpy).toHaveBeenCalledWith("Unable to store your pin.")
      expect(mockGoBack).not.toHaveBeenCalled()

      /** The failure path runs through returnToSetPin — the keypad must be live
       *  again or the user is stuck. */
      await enterPin("2222")
      await enterPin("2222")

      expect(mockedStore.setPin).toHaveBeenLastCalledWith("2222")
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("backspace edits the entry between attempts", async () => {
      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      /** Types "112", rubs out the stray 2, then finishes "1111". A backspace
       *  that did nothing would leave "1121" and the verification would not
       *  match, so setPin would never see this value. */
      await enterPin("112")
      fireEvent.press(screen.getByTestId("pinPadBackspace"))
      await enterPin("11")
      await enterPin("1111")

      expect(mockedStore.setPin).toHaveBeenCalledWith("1111")
    })
  })

  describe("input while a verification is in flight", () => {
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

    /** Holds the verification open on its stored-pin read. */
    const holdVerification = () => {
      let release: (pin: string) => void = () => {}
      mockedStore.getPin.mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            release = resolve
          }),
      )
      return async () => {
        await act(async () => {
          release(stored.pin ?? "")
        })
      }
    }

    it("disables the whole keypad, backspace included", async () => {
      // Backspace used to be gated only by the `disabled` prop, and that prop
      // did not cover the verifying window at all — so the pad looked live
      // while quietly swallowing presses.
      renderScreen(false)
      await flushEffects()

      const release = holdVerification()
      await enterPin(WRONG_PIN)

      expect(screen.getByTestId("pinPadBackspace")).toBeDisabled()
      expect(screen.getByText("1")).toBeDisabled()

      await release()
    })

    it("runs exactly one verification however many keys are pressed", async () => {
      renderScreen(false)
      await flushEffects()

      const release = holdVerification()
      await enterPin(WRONG_PIN)

      fireEvent.press(screen.getByTestId("pinPadBackspace"))
      await enterPin(WRONG_PIN)

      expect(mockedStore.getPin).toHaveBeenCalledTimes(1)
      await release()
    })

    it("re-enables the keypad once the verification lands", async () => {
      renderScreen(false)
      await flushEffects()

      const release = holdVerification()
      await enterPin(WRONG_PIN)
      await release()
      await advance(11_000)

      expect(screen.getByText("1")).not.toBeDisabled()
    })
  })
})
