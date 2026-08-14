import React from "react"
import { BackHandler } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { PinScreen } from "@app/screens/authentication-screen/pin-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { PinScreenPurpose } from "@app/utils/enum"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { RouteProp } from "@react-navigation/native"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

const mockReset = jest.fn()
const mockGoBack = jest.fn()
const mockSetAppUnlocked = jest.fn()
const mockAddListener = jest.fn()
const mockLogout = jest.fn()

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

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/utils/sleep", () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getPinOrEmptyString: jest.fn().mockResolvedValue("1234"),
    getPinAttemptsOrZero: jest.fn().mockResolvedValue(0),
    resetPinAttempts: jest.fn(),
    setPinAttempts: jest.fn(),
    setPin: jest.fn().mockResolvedValue(true),
    /** Read by the account registry the screen renders under. */
    getSessionProfiles: jest.fn().mockResolvedValue([]),
  },
}))

const CORRECT_PIN = "1234"
const WRONG_PIN = "9999"

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

const enterPin = async (pin: string) => {
  for (const digit of pin.split("")) {
    fireEvent.press(screen.getByText(digit))
  }
  await flushEffects()
}

const pressBackspace = () => fireEvent.press(screen.getByTestId("pin-backspace"))

describe("PinScreen", () => {
  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
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

  it("re-arms the keypad after a wrong guess, so the next attempt can unlock", async () => {
    /** The input lock engages when an attempt dispatches; a wrong (non-lockout)
     *  guess must hand the keypad back or every retry would be dead. */
    renderScreen(true)
    await flushEffects()

    await enterPin(WRONG_PIN)
    await enterPin(CORRECT_PIN)

    expect(KeyStoreWrapper.setPinAttempts).toHaveBeenCalledWith("1")
    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("backspace edits the entry between attempts", async () => {
    renderScreen(true)
    await flushEffects()

    fireEvent.press(screen.getByText("9"))
    pressBackspace()
    await enterPin(CORRECT_PIN)

    /** Had the backspace been dead, the attempt would have been "9123". */
    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
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
      expect(KeyStoreWrapper.resetPinAttempts).toHaveBeenCalledTimes(1)
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

      expect(onChallengeFailure).not.toHaveBeenCalled()
    })

    it("treats dismissal as a decline, exactly once", async () => {
      const onChallengeSuccess = jest.fn()
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure })
      await flushEffects()

      fireBeforeRemove()
      fireBeforeRemove()

      expect(onChallengeFailure).toHaveBeenCalledTimes(1)
      expect(onChallengeSuccess).not.toHaveBeenCalled()
    })

    it("treats the hardware back as a decline too", async () => {
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      fireBeforeRemove("GO_BACK")

      expect(onChallengeFailure).toHaveBeenCalledTimes(1)
    })

    it("stays silent when a stack-wide reset removes the challenge", async () => {
      /** A reset (migration blocker, resume relock, another screen's lockout)
       *  unmounts the caller too — a decline callback would toast and goBack
       *  into a screen that no longer exists. */
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      fireBeforeRemove("RESET")

      expect(onChallengeFailure).not.toHaveBeenCalled()
    })

    it("a reset resolves the challenge: a pop arriving after it reports nothing", async () => {
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      fireBeforeRemove("RESET")
      fireBeforeRemove("POP")

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

      expect(KeyStoreWrapper.setPinAttempts).toHaveBeenCalledWith("1")
      expect(onChallengeSuccess).not.toHaveBeenCalled()
      expect(onChallengeFailure).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()
    })

    it("answers the third wrong guess the way the app lock does: logout and reset", async () => {
      /** The counter is the same one the app lock enforces. Merely failing the challenge
       *  at the cap would hand out a fresh guess per re-entry — an unbounded brute force
       *  against the pin that protects the whole app. */
      ;(KeyStoreWrapper.getPinAttemptsOrZero as jest.Mock).mockResolvedValueOnce(2)
      const onChallengeSuccess = jest.fn()
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure })
      await flushEffects()

      await enterPin(WRONG_PIN)
      fireBeforeRemove()

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "Primary" }],
      })
      /** The reset unmounts the caller; a failure callback into it would be noise. */
      expect(onChallengeSuccess).not.toHaveBeenCalled()
      expect(onChallengeFailure).not.toHaveBeenCalled()
    })

    it("ignores input typed during the lockout's logout window", async () => {
      /** The lockout awaits logout + a grace sleep before resetting the stack. The keypad
       *  must be dead in that window: a correct pin typed there would otherwise resolve
       *  the challenge against a session that is being destroyed. */
      const { sleep } = jest.requireMock("@app/utils/sleep")
      let releaseSleep!: () => void
      ;(sleep as jest.Mock).mockReturnValueOnce(
        new Promise<void>((resolve) => {
          releaseSleep = resolve
        }),
      )
      ;(KeyStoreWrapper.getPinAttemptsOrZero as jest.Mock).mockResolvedValueOnce(2)
      const onChallengeSuccess = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure: jest.fn() })
      await flushEffects()

      await enterPin(WRONG_PIN)
      pressBackspace()
      await enterPin(CORRECT_PIN)

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(onChallengeSuccess).not.toHaveBeenCalled()
      expect(KeyStoreWrapper.resetPinAttempts).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()

      releaseSleep()
      await flushEffects()

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockReset).toHaveBeenCalledTimes(1)
    })

    it("re-arms the keypad after a wrong guess, so the next attempt can resolve", async () => {
      const onChallengeSuccess = jest.fn()
      renderChallenge({ onChallengeSuccess, onChallengeFailure: jest.fn() })
      await flushEffects()

      await enterPin(WRONG_PIN)
      await enterPin(CORRECT_PIN)

      expect(KeyStoreWrapper.setPinAttempts).toHaveBeenCalledWith("1")
      expect(onChallengeSuccess).toHaveBeenCalledTimes(1)
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("still resets the stack when the lockout's logout fails", async () => {
      /** The reset is the lockout's terminal answer; a logout error must not
       *  strand the caller behind a challenge that can no longer resolve. */
      mockLogout.mockRejectedValueOnce(new Error("network down"))
      ;(KeyStoreWrapper.getPinAttemptsOrZero as jest.Mock).mockResolvedValueOnce(2)
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure: jest.fn() })
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "Primary" }],
      })
    })

    it("reads the shared counter at attempt time, not from a mount snapshot", async () => {
      /** A counter snapshotted at mount can rewind strikes recorded elsewhere (unlock,
       *  another challenge) — every attempt must consult the keystore directly. */
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure: jest.fn() })
      await flushEffects()

      expect(KeyStoreWrapper.getPinAttemptsOrZero).not.toHaveBeenCalled()
      ;(KeyStoreWrapper.getPinAttemptsOrZero as jest.Mock).mockResolvedValueOnce(2)

      await enterPin(WRONG_PIN)

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockReset).toHaveBeenCalledTimes(1)
    })
  })

  describe("SetPin: creating a pin from settings", () => {
    it("stores the pin once both entries match", async () => {
      /** The handoff from first entry to verification runs through the same
       *  input lock as every attempt — it must re-arm or creation wedges. */
      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      await enterPin("1111")
      await enterPin("1111")

      expect(KeyStoreWrapper.setPin).toHaveBeenCalledWith("1111")
      expect(KeyStoreWrapper.resetPinAttempts).toHaveBeenCalledTimes(1)
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("re-arms after a mismatch so the user can start over", async () => {
      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      await enterPin("1111")
      await enterPin("2222")

      expect(KeyStoreWrapper.setPin).not.toHaveBeenCalled()

      await enterPin("3333")
      await enterPin("3333")

      expect(KeyStoreWrapper.setPin).toHaveBeenCalledWith("3333")
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })
  })

  it("ignores input typed during the app-lock lockout window", async () => {
    /** Same window as the challenge, on the unlock path: a correct pin typed while the
     *  lockout is logging out must not complete the unlock. */
    const { sleep } = jest.requireMock("@app/utils/sleep")
    let releaseSleep!: () => void
    ;(sleep as jest.Mock).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseSleep = resolve
      }),
    )
    ;(KeyStoreWrapper.getPinAttemptsOrZero as jest.Mock).mockResolvedValueOnce(2)
    renderScreen(true)
    await flushEffects()

    await enterPin(WRONG_PIN)
    await enterPin(CORRECT_PIN)

    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(mockSetAppUnlocked).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()

    releaseSleep()
    await flushEffects()

    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(mockReset).toHaveBeenCalledTimes(1)
  })
})
