import React from "react"
import { AppState, AppStateStatus } from "react-native"
import { render } from "@testing-library/react-native"

import { AppStateWrapper } from "@app/navigation/app-state"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { flushEffects } from "../helpers/flush-effects"

const mockNavigate = jest.fn()
const mockSetAppLocked = jest.fn()
const mockRefetchQueries = jest.fn()

let mockGracePeriodSeconds = 60
let mockIsAuthed = true
let mockIsAppLocked = false

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({
    isAppLocked: mockIsAppLocked,
    setAppLocked: mockSetAppLocked,
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ appLockGracePeriodSeconds: mockGracePeriodSeconds }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({ refetchQueries: mockRefetchQueries }),
}))

jest.mock("@app/utils/analytics", () => ({
  logEnterForeground: jest.fn(),
  logEnterBackground: jest.fn(),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getIsPinEnabled: jest.fn(),
    getIsBiometricsEnabled: jest.fn(),
  },
}))

const mockedKeyStore = jest.mocked(KeyStoreWrapper)

/** Drives the real AppState listener the wrapper subscribes with. */
let emitAppState: (state: AppStateStatus) => Promise<void>

const START_TIME_MS = 1_790_000_000_000
const GRACE_PERIOD_SECONDS = 60

const renderWrapper = () => render(<AppStateWrapper />)

const setLock = ({ pin, biometrics }: { pin: boolean; biometrics: boolean }) => {
  mockedKeyStore.getIsPinEnabled.mockResolvedValue(pin)
  mockedKeyStore.getIsBiometricsEnabled.mockResolvedValue(biometrics)
}

/** Sends the app away and brings it back after `secondsAway` of wall clock. */
const leaveAndReturn = async (secondsAway: number) => {
  await emitAppState("background")
  jest.setSystemTime(START_TIME_MS + secondsAway * 1000)
  await emitAppState("active")
}

describe("AppStateWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    jest.setSystemTime(START_TIME_MS)

    mockGracePeriodSeconds = GRACE_PERIOD_SECONDS
    mockIsAuthed = true
    mockIsAppLocked = false
    setLock({ pin: true, biometrics: false })

    /** Every foreground the suite drives logs, which would bury the run in noise. */
    jest.spyOn(console, "info").mockImplementation(() => {})

    /** The jest environment leaves this undefined; the wrapper seeds its ref from it. */
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      value: "active",
    })

    let listener: (state: AppStateStatus) => void = () => {}
    jest.spyOn(AppState, "addEventListener").mockImplementation((type, handler) => {
      if (type === "change") listener = handler as (state: AppStateStatus) => void
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>
    })
    emitAppState = async (state) => {
      listener(state)
      await flushEffects()
    }
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe("re-locking on resume", () => {
    it("locks when the app returns after the grace period", async () => {
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(GRACE_PERIOD_SECONDS + 1)

      expect(mockSetAppLocked).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith("authenticationCheck", {
        isResume: true,
      })
    })

    it("stays unlocked when the app returns within the grace period", async () => {
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(GRACE_PERIOD_SECONDS - 1)

      expect(mockSetAppLocked).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("locks on biometrics alone, without a PIN", async () => {
      setLock({ pin: false, biometrics: true })
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(GRACE_PERIOD_SECONDS + 1)

      expect(mockSetAppLocked).toHaveBeenCalledTimes(1)
    })

    it("leaves an unprotected account alone, however long it was away", async () => {
      setLock({ pin: false, biometrics: false })
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(GRACE_PERIOD_SECONDS * 100)

      expect(mockSetAppLocked).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("honors a grace period served by the remote config", async () => {
      mockGracePeriodSeconds = 300
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(120)

      expect(mockSetAppLocked).not.toHaveBeenCalled()
    })

    it("locks across the ios sequence, which reaches the background through inactive", async () => {
      renderWrapper()
      await flushEffects()

      await emitAppState("inactive")
      await emitAppState("background")
      jest.setSystemTime(START_TIME_MS + (GRACE_PERIOD_SECONDS + 1) * 1000)
      await emitAppState("active")

      expect(mockSetAppLocked).toHaveBeenCalledTimes(1)
    })
  })

  describe("transitions that must not lock", () => {
    it("ignores a return the app never left for, such as a dismissed call", async () => {
      renderWrapper()
      await flushEffects()

      await emitAppState("inactive")
      await emitAppState("active")

      expect(mockSetAppLocked).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("ignores a foreground the app was launched into, having measured no trip away", async () => {
      /** A process woken straight into the background, by a push notification say, reaches
       *  the foreground without this instance ever having seen it leave. */
      Object.defineProperty(AppState, "currentState", {
        configurable: true,
        value: "background",
      })
      renderWrapper()
      await flushEffects()

      await emitAppState("active")

      expect(mockSetAppLocked).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("leaves a cold start still at its unlock screen alone", async () => {
      /** The lock is already up and the user has yet to answer it. Raising it again would
       *  stack a second unlock screen over the first, costing the user two PIN entries. */
      mockIsAppLocked = true
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(GRACE_PERIOD_SECONDS + 1)

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("does not lock twice for a single trip to the background", async () => {
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(GRACE_PERIOD_SECONDS + 1)
      expect(mockSetAppLocked).toHaveBeenCalledTimes(1)

      /** A second foreground with no trip away in between: the timestamp is spent. */
      await emitAppState("active")

      expect(mockSetAppLocked).toHaveBeenCalledTimes(1)
    })
  })

  describe("existing foreground behavior", () => {
    it("refetches the home query when the app returns", async () => {
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(1)

      expect(mockRefetchQueries).toHaveBeenCalledTimes(1)
    })

    it("does not refetch for a signed-out user", async () => {
      mockIsAuthed = false
      renderWrapper()
      await flushEffects()

      await leaveAndReturn(1)

      expect(mockRefetchQueries).not.toHaveBeenCalled()
    })
  })
})
