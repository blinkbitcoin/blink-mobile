import React from "react"
import { BackHandler } from "react-native"
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

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ reset: mockReset, goBack: mockGoBack }),
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
    getPinOrEmptyString: jest.fn().mockResolvedValue("1234"),
    getPinAttemptsOrZero: jest.fn().mockResolvedValue(0),
    getPinLockedUntilOrZero: jest.fn().mockResolvedValue(0),
    resetPinAttempts: jest.fn().mockResolvedValue(true),
    setPinAttempts: jest.fn().mockResolvedValue(true),
    setPin: jest.fn().mockResolvedValue(true),
    setPinLockedUntil: jest.fn().mockResolvedValue(true),
    removePinLockedUntil: jest.fn().mockResolvedValue(true),
    /** Read by the account registry the screen renders under. */
    getSessionProfiles: jest.fn().mockResolvedValue([]),
  },
}))

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
  beforeAll(() => {
    // ContextForScreen's TypesafeI18n serves from loadedLocales; without this
    // every LL string renders as "" and text assertions are vacuous.
    loadLocale("en")
  })

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

  describe("brute-force lockout", () => {
    const mockedStore = jest.mocked(KeyStoreWrapper)

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

      expect(mockedStore.setPinAttempts).toHaveBeenCalledWith("1")
      expect(mockedStore.setPinLockedUntil).toHaveBeenCalledTimes(1)
      const persisted = Number(mockedStore.setPinLockedUntil.mock.calls[0][0])
      expect(persisted).toBeGreaterThan(Date.now())
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
      await advance(31_000)

      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(mockedStore.resetPinAttempts).toHaveBeenCalled()
      expect(mockedStore.removePinLockedUntil).toHaveBeenCalled()
    })

    it("starts locked when a future lockout is persisted (survives relaunch)", async () => {
      mockedStore.getPinLockedUntilOrZero.mockResolvedValueOnce(Date.now() + 30_000)

      renderScreen(false)
      await flushEffects()

      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
      expect(screen.getByText(/try again in/i)).toBeTruthy()
    })

    it("clamps an absurd persisted lockout to the longest scheduled one", async () => {
      // A wall clock rolled backward after the write must not lock forever.
      mockedStore.getPinLockedUntilOrZero.mockResolvedValueOnce(
        Date.now() + 100 * 24 * 60 * 60 * 1000,
      )

      renderScreen(false)
      await flushEffects()
      await advance(MAX_LOCKOUT_MS + 1000)

      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    })

    it("still logs out on the third failure", async () => {
      mockedStore.getPinAttemptsOrZero.mockResolvedValueOnce(2)

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

    it("never locks the set-pin flow", async () => {
      mockedStore.getPinLockedUntilOrZero.mockResolvedValueOnce(Date.now() + 30_000)

      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      await enterPin("1111")
      await enterPin("1111")

      expect(mockedStore.setPin).toHaveBeenCalledWith("1111")
      expect(mockGoBack).toHaveBeenCalled()
    })
  })
})
