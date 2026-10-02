import React from "react"
import { Text } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { MockedProvider } from "@apollo/client/testing"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import theme from "@app/rne-theme/theme"
import { AuthenticationCheckScreen } from "@app/screens/authentication-screen/authentication-check-screen"
import { PinScreen } from "@app/screens/authentication-screen/pin-screen"
import { PersistentStateContext } from "@app/store/persistent-state"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { ThemeProvider } from "@rn-vui/themed"

import { flushEffects } from "../../helpers/flush-effects"

/**
 * The spent budget's whole way round, on a real stack: the keypad, the logout its third
 * failure triggers, the gate that logout returns to, and whatever the gate opens next.
 * Each screen's own spec pins its half; this pins what the halves compose into. Only the
 * device is faked: what it stores, and whether it holds a session.
 */

jest.mock("@app/assets/logo/app-logo-dark.svg", () => "AppLogoDark")
jest.mock("@app/assets/logo/blink-logo-light.svg", () => "AppLogoLight")

const CORRECT_PIN = "1234"
const WRONG_PIN = "9999"
const STORED_WALLET_ID = "stored-wallet"

type Device = {
  pin: string | null
  attempts: number
  walletIds: ReadonlyArray<string>
  hasSession: boolean
  isAppLocked: boolean
}

let mockDevice: Device

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    readIsPinEnabled: async () => ({ status: mockDevice.pin === null ? "no" : "yes" }),
    readIsBiometricsEnabled: async () => ({ status: "no" }),
    getPin: async () => mockDevice.pin,
    getPinFailureState: async () => ({
      status: "found",
      state: { attempts: mockDevice.attempts },
    }),
    setPinFailureState: async ({ attempts }: { attempts: number }) => {
      mockDevice.attempts = attempts
      return true
    },
    clearPinFailureState: async () => {
      mockDevice.attempts = 0
      return true
    },
    removePin: async () => {
      mockDevice.pin = null
      return true
    },
    removeIsBiometricsEnabled: async () => true,
    removeSessionProfiles: async () => true,
  },
}))

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: { isSensorAvailable: async () => false },
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  ...jest.requireActual("@app/self-custodial/storage/account-index"),
  listSelfCustodialAccounts: async () => ({
    status: "ok",
    entries: mockDevice.walletIds.map((id) => ({ id, lightningAddress: null })),
  }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockDevice.hasSession,
}))

/** The lock flag's context pulls in native boot code; the flag itself is all the lock
 *  screens touch, so it is kept on the faked device. */
jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({
    setAppLocked: () => {
      mockDevice.isAppLocked = true
    },
    setAppUnlocked: () => {
      mockDevice.isAppLocked = false
    },
  }),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateDeviceSessionCount: jest.fn(),
}))

jest.mock("@app/utils/analytics", () => ({
  logLogout: jest.fn(),
}))

jest.mock("@react-native-firebase/messaging", () => () => ({
  getToken: async () => "",
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { multiRemove: async () => undefined },
}))

const Stack = createNativeStackNavigator<RootStackParamList>()

const HomeScreen = () => <Text>home screen</Text>
const LandingScreen = () => <Text>landing screen</Text>

const persistentStateValue: NonNullable<
  React.ContextType<typeof PersistentStateContext>
> = {
  persistentState: {
    schemaVersion: 21,
    galoyInstance: { id: "Main" },
    galoyAuthToken: "",
  },
  updateState: () => {},
  resetState: () => {},
  clearToken: async () => {
    mockDevice.hasSession = false
  },
}

const launchApp = () =>
  render(
    <ThemeProvider theme={theme}>
      <MockedProvider mocks={[]}>
        <PersistentStateContext.Provider value={persistentStateValue}>
          <TypesafeI18n locale="en">
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName="authenticationCheck"
                screenOptions={{ headerShown: false }}
              >
                <Stack.Screen
                  name="authenticationCheck"
                  component={AuthenticationCheckScreen}
                />
                <Stack.Screen name="pin" component={PinScreen} />
                <Stack.Screen name="Primary" component={HomeScreen} />
                <Stack.Screen name="getStarted" component={LandingScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </TypesafeI18n>
        </PersistentStateContext.Provider>
      </MockedProvider>
    </ThemeProvider>,
  )

const enterPin = async (pin: string) => {
  for (const digit of pin.split("")) {
    fireEvent.press(screen.getByText(digit))
  }
  await flushEffects()
}

/** The farewell stays up for a second before the keypad leaves for the gate. */
const waitOutFarewell = async () => {
  await flushEffects()
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
  await flushEffects()
}

const spendBudget = async () => {
  await enterPin(WRONG_PIN)
  await enterPin(WRONG_PIN)
  await enterPin(WRONG_PIN)
  await waitOutFarewell()
}

describe("the spent PIN budget, from the keypad round to wherever the gate opens", () => {
  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    // flushEffects relies on setImmediate; keep it real so effects settle.
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    mockDevice = {
      pin: CORRECT_PIN,
      attempts: 0,
      walletIds: [],
      hasSession: true,
      isAppLocked: true,
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("on a device that stores a wallet", () => {
    beforeEach(() => {
      mockDevice.walletIds = [STORED_WALLET_ID]
    })

    it("ends the session and comes back to the same lock, with nothing around it", async () => {
      launchApp()
      await flushEffects()

      await spendBudget()

      /** The session went; the lock, spent count included, did not. */
      expect(mockDevice.hasSession).toBe(false)
      expect(mockDevice.pin).toBe(CORRECT_PIN)
      expect(mockDevice.attempts).toBe(3)
      expect(mockDevice.isAppLocked).toBe(true)

      /** The keypad again, live, one entry from ending the round, and no way past it. */
      expect(screen.getByText("Incorrect PIN. 1 attempt remaining.")).toBeTruthy()
      expect(screen.getByText("1")).not.toBeDisabled()
      expect(screen.queryByTestId("pinScreenDismiss")).toBeNull()
      expect(screen.queryByText("home screen")).toBeNull()
      expect(screen.queryByText("landing screen")).toBeNull()
    })

    it("keeps coming back to it for as long as the entry is wrong", async () => {
      launchApp()
      await flushEffects()
      await spendBudget()

      await enterPin(WRONG_PIN)
      await waitOutFarewell()

      expect(mockDevice.pin).toBe(CORRECT_PIN)
      expect(mockDevice.attempts).toBe(4)
      expect(mockDevice.isAppLocked).toBe(true)
      expect(screen.getByText("Incorrect PIN. 1 attempt remaining.")).toBeTruthy()
      expect(screen.queryByText("home screen")).toBeNull()
      expect(screen.queryByText("landing screen")).toBeNull()
    })

    it("opens the stored wallet for the correct PIN, and clears the spent count", async () => {
      launchApp()
      await flushEffects()
      await spendBudget()

      await enterPin(CORRECT_PIN)

      expect(screen.getByText("home screen")).toBeTruthy()
      expect(mockDevice.attempts).toBe(0)
      expect(mockDevice.isAppLocked).toBe(false)
    })
  })

  describe("on a device that stores no wallet", () => {
    it("removes the lock with the session and lands on the landing screen", async () => {
      launchApp()
      await flushEffects()

      await spendBudget()

      /** Nothing is left for the lock to guard, so it goes, spent count included: the way
       *  back in is a sign-in, which a lock still set would stand in front of. */
      expect(mockDevice.hasSession).toBe(false)
      expect(mockDevice.pin).toBeNull()
      expect(mockDevice.attempts).toBe(0)
      expect(mockDevice.isAppLocked).toBe(false)

      expect(screen.getByText("landing screen")).toBeTruthy()
      expect(screen.queryByText("home screen")).toBeNull()
    })
  })
})
