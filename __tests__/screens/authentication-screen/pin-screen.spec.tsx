import React from "react"
import { Alert, BackHandler } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { PinScreen } from "@app/screens/authentication-screen/pin-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { PinScreenPurpose } from "@app/utils/enum"
import { RouteProp } from "@react-navigation/native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

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

/** Leaving the lock screen without having answered it: back to the gate, lock raised. What
 *  that does is its own spec; here it only has to be what the terminal outcomes call. */
const mockReturnToGate = jest.fn()

jest.mock("@app/hooks/use-return-to-gate", () => ({
  useReturnToGate: () => mockReturnToGate,
}))

/** What gives the device an account to show once its lock is answered: a session, or
 *  failing that a wallet it stores. A session is there unless a test puts a device with
 *  none behind its lock on the screen. */
let mockIsAuthed = true
const mockListSelfCustodialAccounts = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  ...jest.requireActual("@app/self-custodial/storage/account-index"),
  listSelfCustodialAccounts: () => mockListSelfCustodialAccounts(),
}))

const storedWallets = (ids: ReadonlyArray<string>) => ({
  status: "ok",
  entries: ids.map((id) => ({ id, lightningAddress: null })),
})

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

/** The waits the first two failures start, which is what a test has to sit out
 *  before the keypad takes its next entry. */
const FIRST_FAILURE_WAIT_MS = 10_000
const SECOND_FAILURE_WAIT_MS = 30_000
const MINUTE_MS = 60_000

const mockedStore = jest.mocked(KeyStoreWrapper)

/**
 * A real keystore rather than per-call stubs, because the verification re-reads
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
  mockIsAuthed = true
  mockListSelfCustodialAccounts.mockResolvedValue(storedWallets([]))
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

/** Moves the faked clock, with the effects on either side of it settled. For the suites
 *  that fake timers: the terminal logout ends in a one-second farewell, and a real timer
 *  there would outlive its test and return to the gate inside a later one. */
const advance = async (ms: number) => {
  await flushEffects()
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
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

  it("lands on the landing screen when the device has no account behind its lock", async () => {
    /** Every launch passes the lock now, including one on a device that holds no account
     *  at all. Answering it there must not open a home screen with nothing to show. */
    mockIsAuthed = false
    renderScreen(false)
    await flushEffects()

    await enterPin(CORRECT_PIN)

    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "getStarted" }],
    })
  })

  it("opens the home screen for a wallet stored with no session behind the lock", async () => {
    /** What a logout leaves behind on a device that stores a wallet: the account its
     *  owner expects to find behind the lock they just answered. */
    mockIsAuthed = false
    mockListSelfCustodialAccounts.mockResolvedValue(storedWallets(["stored-wallet-id"]))
    renderScreen(false)
    await flushEffects()

    await enterPin(CORRECT_PIN)

    expect(mockReset).toHaveBeenCalledTimes(1)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Primary" }],
    })
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

  describe("the attempt budget", () => {
    beforeEach(() => {
      // flushEffects relies on setImmediate; keep it real so effects settle.
      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("persists the attempt before showing the result", async () => {
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockedStore.setPinFailureState).toHaveBeenCalledTimes(1)
      expect(stored.attempts).toBe(1)
    })

    it("shows how many attempts are left after a wrong entry", async () => {
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(screen.getByText("Incorrect PIN. 2 attempts remaining.")).toBeTruthy()
    })

    it("takes the correct pin on the next try and clears the spent count", async () => {
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)
      await advance(FIRST_FAILURE_WAIT_MS)
      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(mockedStore.clearPinFailureState).toHaveBeenCalled()
      expect(stored).toMatchObject({ attempts: 0, lockedUntil: 0 })
    })

    it("shuts the keypad for the wait a wrong entry starts, and says for how long", async () => {
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(screen.getByText("Incorrect PIN. 2 attempts remaining.")).toBeTruthy()
      expect(screen.getByText("Try again in 00:10.")).toBeTruthy()
      expect(screen.getByText("1")).toBeDisabled()
      expect(screen.getByTestId("pinPadBackspace")).toBeDisabled()
    })

    it("takes no entry while the wait runs", async () => {
      renderScreen(false)
      await flushEffects()
      await enterPin(WRONG_PIN)
      mockedStore.getPin.mockClear()

      await enterPin(CORRECT_PIN)

      expect(mockedStore.getPin).not.toHaveBeenCalled()
      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
      expect(stored.attempts).toBe(1)
    })

    it("counts the wait down and hands the keypad back when it is over", async () => {
      renderScreen(false)
      await flushEffects()
      await enterPin(WRONG_PIN)

      await advance(4_000)
      expect(screen.getByText("Try again in 00:06.")).toBeTruthy()

      await advance(6_000)
      expect(screen.queryByText(/Try again in/)).toBeNull()
      expect(screen.getByText("1")).not.toBeDisabled()
      /** The count outlives the wait: it is the budget, not the lock. */
      expect(screen.getByText("Incorrect PIN. 2 attempts remaining.")).toBeTruthy()
    })

    it("warns about the last attempt on the second wrong entry, with a longer wait", async () => {
      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)
      await advance(FIRST_FAILURE_WAIT_MS)
      await enterPin(WRONG_PIN)

      expect(screen.getByText("Incorrect PIN. 1 attempt remaining.")).toBeTruthy()
      expect(screen.getByText("Try again in 00:30.")).toBeTruthy()
    })

    it("comes back from a relaunch to a keypad that is still shut", async () => {
      // A force-quit must not be a way around the wait.
      stored.attempts = 1
      stored.lockedUntil = Date.now() + FIRST_FAILURE_WAIT_MS

      renderScreen(false)
      await flushEffects()

      expect(screen.getByText("Try again in 00:10.")).toBeTruthy()
      expect(screen.getByText("1")).toBeDisabled()
    })

    it("warns about the last attempt after a relaunch, not just in session", async () => {
      // The warning used to live in component state, so relaunching lost it and
      // the next wrong entry wiped the pin and session without notice.
      stored.attempts = 2

      renderScreen(false)
      await flushEffects()

      /** Stated without "Incorrect PIN": nobody has typed a wrong one on this screen. */
      expect(screen.getByText("1 attempt remaining.")).toBeTruthy()
      expect(screen.queryByText(/Incorrect PIN/)).toBeNull()
    })

    it("says the budget is spent over the keypad that comes back, with no number of attempts", async () => {
      /** The lock can outlive the logout a third failure triggers, and this keypad is
       *  what comes back after it. A wrong entry no longer costs a session there, only a
       *  longer wait, so there is no number of attempts left to state. */
      stored.attempts = 3

      renderScreen(false)
      await flushEffects()

      expect(screen.getByText("Too many failed attempts.")).toBeTruthy()
      expect(screen.queryByText(/attempts? remaining/)).toBeNull()
      expect(screen.getByText("1")).not.toBeDisabled()
    })

    it("shows the long wait of a spent budget on the clock, in minutes", async () => {
      stored.attempts = 4
      stored.lockedUntil = Date.now() + 5 * MINUTE_MS

      renderScreen(false)
      await flushEffects()

      expect(screen.getByText("Too many failed attempts.")).toBeTruthy()
      expect(screen.getByText("Try again in 05:00.")).toBeTruthy()
      expect(screen.getByText("1")).toBeDisabled()

      await advance(4 * MINUTE_MS + 30_000)
      expect(screen.getByText("Try again in 00:30.")).toBeTruthy()
    })

    it("still logs out on the third failure", async () => {
      stored.attempts = 2

      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      /** A plain logout: whether the lock survives it is the logout's own call,
       *  made on what the device still stores. The lock can outlive it, so the
       *  screen returns to the gate to ask whether the device is still locked
       *  rather than assume it is not. */
      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockLogout).toHaveBeenCalledWith()
      /** Said without promising a logout: on a later round the session is already gone. */
      expect(screen.getByText("Too many failed attempts.")).toBeTruthy()
      /** The farewell stays on screen for a full second before the screen leaves. */
      await advance(999)
      expect(mockReturnToGate).not.toHaveBeenCalled()
      await advance(1)
      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
      expect(mockReset).not.toHaveBeenCalled()
    })

    it("logs out rather than let an attempt go unrecorded", async () => {
      // A budget held only in memory dies with the process, so a failed write
      // has to end the session instead of leaving the next guess free.
      mockedStore.setPinFailureState.mockResolvedValue(false)

      renderScreen(false)
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockLogout).toHaveBeenCalledWith()
      expect(screen.getByText("Couldn't record the attempt securely.")).toBeTruthy()

      /** The same way out as the spent budget: to the gate, once the farewell has shown. */
      expect(mockReturnToGate).not.toHaveBeenCalled()
      await advance(1000)
      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
      expect(mockReset).not.toHaveBeenCalled()
    })

    it("does not open on the correct pin either when the attempt cannot be written down", async () => {
      /** No entry is judged before it is in the store. One judged with nothing written
       *  would be a guess that costs nothing, so the correct one is refused with the rest. */
      mockedStore.setPinFailureState.mockResolvedValue(false)

      renderScreen(false)
      await flushEffects()

      await enterPin(CORRECT_PIN)

      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Couldn't record the attempt securely.")).toBeTruthy()
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
      expect(screen.getByText("2 attempts remaining.")).toBeTruthy()
      expect(stored.attempts).toBe(1)
      expect(mockLogout).not.toHaveBeenCalled()
      expect(screen.getByText("1")).not.toBeDisabled()
    })

    it("drops a guess made before the screen hydrated, rather than miscounting it", async () => {
      // The relaunch bypass: the screen's own state starts at zero attempts, so
      // a guess entered before hydration used to be scored against that and
      // write the stored count back DOWN to 1. The keypad refuses input until
      // the read lands, so the stored budget is never contradicted.
      stored.attempts = 2

      renderScreen(false)
      await enterPin(WRONG_PIN)

      expect(stored.attempts).toBe(2)
      expect(mockLogout).not.toHaveBeenCalled()
    })

    it("reaches the logout even when the app is killed between every guess", async () => {
      // Each guess lands in a freshly mounted screen that has hydrated nothing,
      // so nothing but storage carries the count between them. It still runs out.
      const waitAfterFailure = [FIRST_FAILURE_WAIT_MS, SECOND_FAILURE_WAIT_MS]
      for (const attempt of [1, 2]) {
        const { unmount } = renderScreen(false)
        await flushEffects()
        await enterPin(WRONG_PIN)
        expect(stored.attempts).toBe(attempt)
        unmount()
        /** Killing the app does not shorten the wait: it is sat out all the same. */
        await advance(waitAfterFailure[attempt - 1])
      }

      renderScreen(false)
      await flushEffects()
      await enterPin(WRONG_PIN)

      expect(mockLogout).toHaveBeenCalledTimes(1)
    })

    it("never spends the budget in the set-pin flow", async () => {
      stored.attempts = 2

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

    it("refuses input while the pin is being stored", async () => {
      /** The pad stays enabled here: the set-pin flow has no verification state
       *  to disable it, so the in-flight guard is the only thing between a tap
       *  and the entry. The digit is turned away by the full entry as well; the
       *  backspace is the press only the guard stops. Let through, it would
       *  shrink "1111", and the digit after it would complete "1112" against
       *  "1111" and re-arm the screen with the mismatch text while the store
       *  was still in flight. */
      let releaseStore: (stored: boolean) => void = () => {}
      mockedStore.setPin.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseStore = resolve
          }),
      )

      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      await enterPin("1111")
      await enterPin("1111")

      fireEvent.press(screen.getByTestId("pinPadBackspace"))
      fireEvent.press(screen.getByText("2"))

      expect(screen.getByText("Verify your PIN code")).toBeTruthy()
      expect(screen.queryByText("Pins didn't match - Set your PIN code")).toBeNull()

      await act(async () => {
        releaseStore(true)
      })

      expect(mockedStore.setPin).toHaveBeenCalledTimes(1)
      expect(mockedStore.setPin).toHaveBeenCalledWith("1111")
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("ignores a stray tap on the full entry once the pin is stored", async () => {
      /** Success leaves the four digits on screen while the pop animates out. A
       *  fifth digit landing in that window must not read as a new, longer entry
       *  and re-run the confirmation against the pin just stored. */
      renderScreen(undefined, PinScreenPurpose.SetPin)
      await flushEffects()

      await enterPin("1111")
      await enterPin("1111")
      expect(mockGoBack).toHaveBeenCalledTimes(1)

      fireEvent.press(screen.getByText("2"))

      expect(screen.queryByText("Pins didn't match - Set your PIN code")).toBeNull()
      expect(mockedStore.setPin).toHaveBeenCalledTimes(1)
    })
  })

  describe("input while a verification is in flight", () => {
    beforeEach(() => {
      // A wrong entry starts a wait, which the last test sits out. flushEffects
      // relies on setImmediate; keep it real so effects settle.
      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

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

    it("re-enables the keypad once the verification has landed and its wait is over", async () => {
      renderScreen(false)
      await flushEffects()

      const release = holdVerification()
      await enterPin(WRONG_PIN)
      await release()

      /** Verified, and wrong: what keeps the keypad shut now is the wait, not the guard. */
      expect(screen.getByText("1")).toBeDisabled()

      await advance(FIRST_FAILURE_WAIT_MS)

      expect(screen.getByText("1")).not.toBeDisabled()
    })
  })
})

/** Split from the block above only to stay inside max-lines-per-function; the
 *  arrangement is the same. */
describe("PinScreen ChallengePin", () => {
  beforeAll(() => {
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
      /** A reset (migration blocker, resume relock, the spent budget's logout)
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

    /**
     * RESET is the one removal the challenge doesn't own, because it takes the
     * caller with it. Every other removal leaves the caller mounted and waiting,
     * so silence there is a caller stuck on a spinner forever — which is what an
     * allowlist of pop-family types produced for everything it did not list.
     */
    it("declines when a removal the pop family never named takes the screen", async () => {
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      // A deep link or notification routing away while the challenge is focused.
      fireBeforeRemove("REPLACE")
      await flushDeferredDecline()

      expect(onChallengeFailure).toHaveBeenCalledTimes(1)
    })

    it("declines on an action type nothing here anticipated", async () => {
      const onChallengeFailure = jest.fn()
      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
      await flushEffects()

      fireBeforeRemove("SOME_FUTURE_ACTION")
      await flushDeferredDecline()

      expect(onChallengeFailure).toHaveBeenCalledTimes(1)
    })

    /**
     * The two resolutions can be in flight at once: the entry is being verified
     * when the user taps dismiss. Both used to fire, so the caller rendered its
     * protected content and was popped out of it a tick later.
     */
    describe("a dismiss landing while the entry is still being verified", () => {
      /** Holds `verifyPin` open at its stored-pin read. */
      const verificationHeldOpen = () => {
        let release = () => {}
        mockedStore.getPin.mockImplementation(
          () =>
            new Promise<string | null>((resolve) => {
              release = () => resolve(stored.pin)
            }),
        )
        return () => release()
      }

      it("reports the decline and not also the success", async () => {
        const release = verificationHeldOpen()
        const onChallengeSuccess = jest.fn()
        const onChallengeFailure = jest.fn()
        renderChallenge({ onChallengeSuccess, onChallengeFailure })
        await flushEffects()

        await enterPin(CORRECT_PIN)
        fireBeforeRemove()
        await act(async () => {
          release()
        })
        await flushDeferredDecline()

        expect(onChallengeFailure).toHaveBeenCalledTimes(1)
        expect(onChallengeSuccess).not.toHaveBeenCalled()
      })

      it("does not step back a second time on the verification that lost", async () => {
        const release = verificationHeldOpen()
        renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure: jest.fn() })
        await flushEffects()

        await enterPin(CORRECT_PIN)
        fireBeforeRemove()
        await act(async () => {
          release()
        })
        await flushDeferredDecline()

        /** The removal is already under way; a goBack here would pop whatever
         *  the caller landed on. */
        expect(mockGoBack).not.toHaveBeenCalled()
      })

      it("still resolves normally when nothing dismisses it", async () => {
        const release = verificationHeldOpen()
        const onChallengeSuccess = jest.fn()
        const onChallengeFailure = jest.fn()
        renderChallenge({ onChallengeSuccess, onChallengeFailure })
        await flushEffects()

        await enterPin(CORRECT_PIN)
        await act(async () => {
          release()
        })
        await flushDeferredDecline()

        expect(onChallengeSuccess).toHaveBeenCalledTimes(1)
        expect(onChallengeFailure).not.toHaveBeenCalled()
        expect(mockGoBack).toHaveBeenCalledTimes(1)
      })
    })

    /**
     * The terminal outcomes set the farewell and then tear the session down. A
     * dismiss tapped in that window declines into a session already going away
     * and races the reset that ends it.
     */
    describe("the dismiss control during the logout teardown", () => {
      beforeEach(() => {
        // flushEffects relies on setImmediate; keep it real so effects settle.
        jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      })

      afterEach(() => {
        jest.useRealTimers()
      })

      it("ignores a tap while the logout runs", async () => {
        let releaseLogout!: () => void
        mockLogout.mockReturnValueOnce(
          new Promise<void>((resolve) => {
            releaseLogout = resolve
          }),
        )
        stored.attempts = 2

        const onChallengeFailure = jest.fn()
        renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure })
        await flushEffects()

        await enterPin(WRONG_PIN)
        fireEvent.press(screen.getByTestId("pinScreenDismiss"))
        /** A decline is deferred a tick, so a tick is what would let one through. */
        await advance(0)

        expect(mockGoBack).not.toHaveBeenCalled()
        expect(onChallengeFailure).not.toHaveBeenCalled()

        releaseLogout()
        await advance(1000)
        expect(mockReturnToGate).toHaveBeenCalledTimes(1)
        expect(onChallengeFailure).not.toHaveBeenCalled()
      })

      /**
       * Deliberately still live after a failure, which is where gating the
       * control on the keypad's own disabled state would have put it: a
       * challenge the user is getting wrong is exactly when they most want to
       * leave, and the back gesture lets them regardless.
       */
      it("still dismisses after a wrong guess has spent budget", async () => {
        renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure: jest.fn() })
        await flushEffects()

        await enterPin(WRONG_PIN)
        expect(screen.getByText("Incorrect PIN. 2 attempts remaining.")).toBeTruthy()

        fireEvent.press(screen.getByTestId("pinScreenDismiss"))

        expect(mockGoBack).toHaveBeenCalledTimes(1)
      })
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
      expect(mockReturnToGate).not.toHaveBeenCalled()
    })

    it("still returns to the gate when the terminal logout fails", async () => {
      /** Leaving is the spent budget's terminal answer; a logout error must not
       *  strand the caller behind a challenge that can no longer resolve. */
      mockLogout.mockRejectedValueOnce(new Error("network down"))
      stored.attempts = 2

      renderChallenge({ onChallengeSuccess: jest.fn(), onChallengeFailure: jest.fn() })
      await flushEffects()

      await enterPin(WRONG_PIN)

      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
    })

    describe("after a wrong guess has landed", () => {
      beforeEach(() => {
        // The exhausted path sleeps 1s before leaving for the gate, and the
        // tests that reach it advance through that wait. flushEffects relies
        // on setImmediate; keep it real so effects settle.
        jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      })

      afterEach(() => {
        jest.useRealTimers()
      })

      it("re-arms the keypad, so the next attempt can resolve", async () => {
        const onChallengeSuccess = jest.fn()
        renderChallenge({ onChallengeSuccess, onChallengeFailure: jest.fn() })
        await flushEffects()

        await enterPin(WRONG_PIN)
        expect(stored.attempts).toBe(1)

        await advance(FIRST_FAILURE_WAIT_MS)

        await enterPin(CORRECT_PIN)

        expect(onChallengeSuccess).toHaveBeenCalledTimes(1)
        expect(mockGoBack).toHaveBeenCalledTimes(1)
      })

      it("ignores input typed during the terminal logout window", async () => {
        /** The screen awaits logout + a grace sleep before leaving for the gate. The
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
        await advance(1000)
        expect(mockReturnToGate).toHaveBeenCalledTimes(1)
        expect(onChallengeSuccess).not.toHaveBeenCalled()
      })

      it("answers the third wrong guess the way the app lock does: logout and reset", async () => {
        /** The budget is the one the app lock enforces. Merely failing the challenge
         *  at the cap would leave the session open and hand out a fresh guess per
         *  re-entry, so the cap would cost whoever is guessing nothing. */
        stored.attempts = 2
        const onChallengeSuccess = jest.fn()
        const onChallengeFailure = jest.fn()
        renderChallenge({ onChallengeSuccess, onChallengeFailure })
        await flushEffects()

        await enterPin(WRONG_PIN)

        expect(mockLogout).toHaveBeenCalledTimes(1)
        expect(mockReturnToGate).not.toHaveBeenCalled()
        await advance(1000)

        /** With the lock raised, though the session it ran in was unlocked: a gate shown
         *  with the flag down would let a payment link open over the lock screen. */
        expect(mockReturnToGate).toHaveBeenCalledTimes(1)
        /** The reset unmounts the caller; a failure callback into it would be noise. */
        expect(onChallengeSuccess).not.toHaveBeenCalled()
        expect(onChallengeFailure).not.toHaveBeenCalled()
      })
    })
  })
})
