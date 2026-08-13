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

/** Runs whatever the screen registered for beforeRemove — the navigator popping the screen,
 *  whether by gesture, hardware back, or the screen's own goBack. */
const fireBeforeRemove = () => {
  const registration = mockAddListener.mock.calls.find(
    ([eventName]) => eventName === "beforeRemove",
  )
  registration?.[1]()
}

const enterPin = async (pin: string) => {
  for (const digit of pin.split("")) {
    fireEvent.press(screen.getByText(digit))
  }
  await flushEffects()
}

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
  })
})
