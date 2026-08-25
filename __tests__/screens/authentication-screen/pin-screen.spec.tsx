import React from "react"
import { BackHandler } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { PinScreen } from "@app/screens/authentication-screen/pin-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { PinScreenPurpose } from "@app/utils/enum"
import { RouteProp } from "@react-navigation/native"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

const mockReset = jest.fn()
const mockGoBack = jest.fn()
const mockSetAppUnlocked = jest.fn()
const mockLogout = jest.fn()
const mockGetPinAttemptsOrZero = jest.fn().mockResolvedValue(0)

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ reset: mockReset, goBack: mockGoBack }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getPinOrEmptyString: jest.fn().mockResolvedValue("1234"),
    getPinAttemptsOrZero: () => mockGetPinAttemptsOrZero(),
    resetPinAttempts: jest.fn(),
    setPinAttempts: jest.fn(),
    /** Read by the account registry the screen renders under. */
    getSessionProfiles: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock("@app/utils/sleep", () => ({ sleep: jest.fn().mockResolvedValue(undefined) }))

const CORRECT_PIN = "1234"
const WRONG_PIN = "9999"

const buildRoute = (
  isResume?: boolean,
  screenPurpose: PinScreenPurpose = PinScreenPurpose.AuthenticatePin,
): RouteProp<RootStackParamList, "pin"> =>
  ({
    key: "pin",
    name: "pin",
    params: { screenPurpose, isResume },
  }) as RouteProp<RootStackParamList, "pin">

const renderScreen = (isResume?: boolean, screenPurpose?: PinScreenPurpose) =>
  render(
    <ContextForScreen>
      <PinScreen route={buildRoute(isResume, screenPurpose)} />
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

const enterPin = async (pin: string) => {
  for (const digit of pin.split("")) {
    fireEvent.press(screen.getByText(digit))
  }
  await flushEffects()
}

describe("PinScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  describe("exhausting the attempt budget", () => {
    it("logs out without deleting the PIN, so the attacker lands back on a gate, not Home", async () => {
      // Regression for the multi-account/anon-wallet bypass: a bare logout()
      // call here deletes the PIN, which is the only thing gating re-entry
      // (getIsPinEnabled() is just "is a PIN stored"). A third wrong guess
      // must never resolve onto Primary directly.
      mockGetPinAttemptsOrZero.mockResolvedValue(2)
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockLogout).toHaveBeenCalledWith({ preservePin: true })
      expect(mockReset).not.toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "Primary" }],
      })
    })

    it("routes back through the authentication gate instead of Primary", async () => {
      mockGetPinAttemptsOrZero.mockResolvedValue(2)
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "authenticationCheck" }],
      })
    })
  })
})
