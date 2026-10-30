import React from "react"
import { render, waitFor } from "@testing-library/react-native"

import { AuthenticationCheckScreen } from "@app/screens/authentication-screen/authentication-check-screen"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "@app/utils/enum"

import { ContextForScreen } from "../helper"

/**
 * The launch gate over the real storage stack, with only the two keychains faked. A PIN set
 * under an older release lives in the legacy keychain until its first read moves it, so what
 * that keychain answers for it is what decides whether the app opens.
 *
 * The legacy keychain answers as `patches/react-native-secure-key-store+2.0.10.patch` leaves
 * the iOS module (ios/RNSecureKeyStore.m): `get:` rejects with "404" only for an item the
 * keychain reports missing and with "1" for any other failure. Unpatched it rejected every
 * failure with "404", and a PIN the keychain would not answer for read as no PIN at all.
 */

const mockLegacyItems = new Map<string, string>()

/** Items the keychain holds but will not answer for, as under a class not available yet. */
const mockUnanswered = new Set<string>()

/** Kept healthy: the new store reports its own faults, and only the legacy one is at issue. */
const mockNewKeychain = new Map<string, string>()

const mockNativeRejection = (code: string, message: string) =>
  Object.assign(new Error(message), { code })

jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: async (key: string) => {
      if (mockUnanswered.has(key)) throw mockNativeRejection("1", "key could not be read")
      const value = mockLegacyItems.get(key)
      if (value === undefined) throw mockNativeRejection("404", "key does not present")
      return value
    },
    set: async (key: string, value: string) => {
      if (mockUnanswered.has(key)) throw mockNativeRejection("9", "error saving key")
      mockLegacyItems.set(key, value)
      return "key stored successfully"
    },
    remove: async (key: string) => {
      const isRefused = mockUnanswered.has(key) || !mockLegacyItems.has(key)
      if (isRefused) throw mockNativeRejection("6", "could not delete key")
      mockLegacyItems.delete(key)
      return "key removed successfully"
    },
    setResetOnAppUninstallTo: () => true,
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  },
}))

jest.mock("react-native-keychain", () => ({
  __esModule: true,
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  },
  getInternetCredentials: async (server: string) => {
    const password = mockNewKeychain.get(server)
    return password === undefined ? false : { server, username: server, password }
  },
  hasInternetCredentials: async ({ server }: { server: string }) =>
    mockNewKeychain.has(server),
  setInternetCredentials: async (server: string, _username: string, password: string) => {
    mockNewKeychain.set(server, password)
    return { service: server }
  },
  resetInternetCredentials: async ({ server }: { server: string }) => {
    mockNewKeychain.delete(server)
  },
}))

jest.mock("@app/assets/logo/app-logo-dark.svg", () => "AppLogoDark")
jest.mock("@app/assets/logo/blink-logo-light.svg", () => "AppLogoLight")

const mockReplace = jest.fn()
const mockSetAppUnlocked = jest.fn()

/** One object across renders, as the real navigation prop is. */
const mockNavigation = { replace: mockReplace, goBack: jest.fn() }

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: undefined }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateDeviceSessionCount: jest.fn(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: { isSensorAvailable: async () => false },
}))

jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: jest.fn(),
}))

const LEGACY_PIN_KEY = "PIN"
const PIN = "1234"

const renderScreen = () =>
  render(
    <ContextForScreen>
      <AuthenticationCheckScreen />
    </ContextForScreen>,
  )

const routedTo = async () => {
  await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  return mockReplace.mock.calls[0]
}

beforeEach(() => {
  jest.clearAllMocks()
  mockLegacyItems.clear()
  mockUnanswered.clear()
  mockNewKeychain.clear()
})

describe("the launch gate on the iOS legacy keychain", () => {
  it("sends the launch to the lock when the keychain will not answer for a PIN not yet moved", async () => {
    mockLegacyItems.set(LEGACY_PIN_KEY, PIN)
    mockUnanswered.add(LEGACY_PIN_KEY)

    renderScreen()

    expect(await routedTo()).toEqual([
      "authentication",
      {
        screenPurpose: AuthenticationScreenPurpose.Authenticate,
        isPinEnabled: true,
        isResume: false,
      },
    ])
    expect(mockSetAppUnlocked).not.toHaveBeenCalled()
  })

  it("asks for a PIN not yet moved once the keychain answers for it", async () => {
    mockLegacyItems.set(LEGACY_PIN_KEY, PIN)

    renderScreen()

    expect(await routedTo()).toEqual([
      "pin",
      { screenPurpose: PinScreenPurpose.AuthenticatePin, isResume: false },
    ])
    expect(mockSetAppUnlocked).not.toHaveBeenCalled()
  })

  it("opens without a lock only when the keychain answers that no PIN is stored", async () => {
    renderScreen()

    expect(await routedTo()).toEqual(["Primary"])
    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
  })
})
