import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { AuthenticationScreen } from "@app/screens/authentication-screen/authentication-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "@app/utils/enum"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RouteProp } from "@react-navigation/native"

import { ContextForScreen, ContextForScreenWithTheme } from "../helper"
import { recordAppError } from "@app/utils/error-reporting"

import { flushEffects } from "../../helpers/flush-effects"

/** The app loads the catalogue at boot; without it every label renders empty and the
 *  buttons become indistinguishable. */
loadLocale("en")

const mockReplace = jest.fn()
const mockReset = jest.fn()
const mockGoBack = jest.fn()
const mockNavigate = jest.fn()
const mockSetAppUnlocked = jest.fn()
const mockLogout = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    replace: mockReplace,
    reset: mockReset,
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: { authenticate: jest.fn() },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    clearPinFailureState: jest.fn().mockResolvedValue(true),
    setIsBiometricsEnabled: jest.fn(),
    /** Read by the account registry the screen renders under. */
    getSessionProfiles: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock("@app/utils/error-reporting", () => ({
  recordAppError: jest.fn(),
}))

jest.mock("@app/assets/logo/app-logo-dark.svg", () => "AppLogoDark")
jest.mock("@app/assets/logo/blink-logo-light.svg", () => "AppLogoLight")

const mockedBiometrics = jest.mocked(BiometricWrapper)

const AppLogoDark = "AppLogoDark" as unknown as React.ComponentType
const AppLogoLight = "AppLogoLight" as unknown as React.ComponentType

const buildRoute = (
  isResume?: boolean,
  screenPurpose: AuthenticationScreenPurpose = AuthenticationScreenPurpose.Authenticate,
  isPinEnabled = true,
): RouteProp<RootStackParamList, "authentication"> =>
  ({
    key: "authentication",
    name: "authentication",
    params: { screenPurpose, isPinEnabled, isResume },
  }) as RouteProp<RootStackParamList, "authentication">

const renderScreen = (
  isResume?: boolean,
  screenPurpose?: AuthenticationScreenPurpose,
  isPinEnabled?: boolean,
) =>
  render(
    <ContextForScreen>
      <AuthenticationScreen route={buildRoute(isResume, screenPurpose, isPinEnabled)} />
    </ContextForScreen>,
  )

/** Presses a button on the most recently shown alert by its label. */
const pressAlertButton = async (text: string) => {
  const buttons = jest.mocked(Alert.alert).mock.lastCall?.[2] as AlertButton[]
  const button = buttons.find((candidate) => candidate.text === text)
  if (!button) {
    throw new Error(`No "${text}" button on the last alert`)
  }
  await act(async () => {
    await button.onPress?.()
  })
}

describe("AuthenticationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    /** clearAllMocks keeps implementations, so a test that makes the clear fail
     *  would otherwise leak that into every test after it. */
    jest.mocked(KeyStoreWrapper).clearPinFailureState.mockResolvedValue(true)
    /** The OS prompt is stubbed as an immediate success so the unlock path runs. */
    mockedBiometrics.authenticate.mockImplementation(async (_description, onSuccess) => {
      onSuccess()
    })
  })

  it("steps back into the screen the user left when the lock came from a resume", async () => {
    renderScreen(true)
    await flushEffects()

    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("opens the home screen on a cold start", async () => {
    renderScreen(false)
    await flushEffects()

    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith("Primary")
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("clears the pin lockout before leaving, so biometrics doesn't strand a lock", async () => {
    // Proving identity biometrically has to release the pin lockout, and the
    // write has to land before we navigate away: a kill in that gap would
    // leave the user locked out, one wrong digit from a forced logout.
    renderScreen(false)
    await flushEffects()

    const clearOrder =
      jest.mocked(KeyStoreWrapper).clearPinFailureState.mock.invocationCallOrder[0]
    expect(clearOrder).toBeLessThan(mockSetAppUnlocked.mock.invocationCallOrder[0])
  })

  it("still unlocks, and reports, when the lockout state cannot be cleared", async () => {
    // The clear is awaited, so a keystore fault sits between the user and their
    // wallet. Refusing entry over it would punish someone who just proved who
    // they are — but the leftover count is sticky, so it has to be reported.
    jest.mocked(KeyStoreWrapper).clearPinFailureState.mockResolvedValue(false)

    renderScreen(false)
    await flushEffects()

    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith("Primary")
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "PIN lockout state could not be cleared" }),
      expect.objectContaining({ alwaysRecord: true }),
    )
  })

  it("treats a missing resume flag as a cold start", async () => {
    renderScreen(undefined)
    await flushEffects()

    expect(mockReplace).toHaveBeenCalledWith("Primary")
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("leaves the user on the lock when the prompt is not passed", async () => {
    mockedBiometrics.authenticate.mockImplementation(
      async (_description, _onSuccess, onFailure) => {
        onFailure()
      },
    )
    renderScreen(true)
    await flushEffects()

    expect(mockSetAppUnlocked).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("swaps in the dark logo when the theme is dark", async () => {
    mockedBiometrics.authenticate.mockImplementation(async () => {})
    render(
      <ContextForScreenWithTheme mode="dark">
        <AuthenticationScreen route={buildRoute(true)} />
      </ContextForScreenWithTheme>,
    )
    await flushEffects()

    expect(screen.UNSAFE_queryByType(AppLogoDark)).toBeTruthy()
    expect(screen.UNSAFE_queryByType(AppLogoLight)).toBeNull()
  })

  describe("setting up biometrics from settings", () => {
    it("records biometrics as enabled and opens home when the check passes", async () => {
      renderScreen(false, AuthenticationScreenPurpose.TurnOnAuthentication)
      await flushEffects()

      expect(KeyStoreWrapper.setIsBiometricsEnabled).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("Primary")
    })

    it("can be skipped straight to the home screen", async () => {
      /** The prompt has to go unanswered, or the screen unlocks before the skip. */
      mockedBiometrics.authenticate.mockImplementation(async () => {})
      renderScreen(false, AuthenticationScreenPurpose.TurnOnAuthentication)
      await flushEffects()

      fireEvent.press(screen.getByLabelText("Skip"))

      expect(mockReplace).toHaveBeenCalledWith("Primary")
    })
  })

  it("renders neither an alternate action nor a title for an unrecognized purpose", async () => {
    /** Route params arrive untyped at runtime (deep links, persisted state), so the
     *  fallback rendering is reachable even though the enum says otherwise. */
    mockedBiometrics.authenticate.mockImplementation(async () => {})
    renderScreen(false, "unknown" as AuthenticationScreenPurpose)
    await flushEffects()

    expect(screen.queryByLabelText("Use PIN")).toBeNull()
    expect(screen.queryByLabelText("Skip")).toBeNull()
    expect(screen.queryByLabelText("Log Out")).toBeNull()
  })

  it("offers no pin fallback when no pin is set", async () => {
    mockedBiometrics.authenticate.mockImplementation(async () => {})
    renderScreen(true, AuthenticationScreenPurpose.Authenticate, false)
    await flushEffects()

    expect(screen.queryByLabelText("Use PIN")).toBeNull()
  })

  describe("logging out from the lock", () => {
    beforeEach(() => {
      jest.spyOn(Alert, "alert")
      /** The prompt has to go unanswered, or the screen unlocks before the logout. */
      mockedBiometrics.authenticate.mockImplementation(async () => {})
    })

    it("resets the stack to the splash, which then cannot lead back into the stale session", async () => {
      /** A resume relock pushes this screen on top of the live stack, so anything short of
       *  a reset leaves the logged-out account's screens behind the splash — and hands it a
       *  back arrow pointing at them, now that its header follows `canGoBack()`. */
      renderScreen(true)
      await flushEffects()

      fireEvent.press(screen.getByLabelText("Log Out"))
      await pressAlertButton("Confirm")
      await pressAlertButton("OK")

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "getStarted" }],
      })
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("stays put until the confirmation is accepted", async () => {
      renderScreen(true)
      await flushEffects()

      fireEvent.press(screen.getByLabelText("Log Out"))

      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()
    })
  })

  describe("falling back to the pin", () => {
    beforeEach(() => {
      /** The prompt has to go unanswered, or the screen unlocks before the fallback. */
      mockedBiometrics.authenticate.mockImplementation(async () => {})
    })

    it("carries the resume flag along, so the pin steps back too", async () => {
      renderScreen(true)
      await flushEffects()

      fireEvent.press(screen.getByLabelText("Use PIN"))

      expect(mockNavigate).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.AuthenticatePin,
        isResume: true,
      })
    })

    it("leaves a cold start unmarked", async () => {
      renderScreen(false)
      await flushEffects()

      fireEvent.press(screen.getByLabelText("Use PIN"))

      expect(mockNavigate).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.AuthenticatePin,
        isResume: false,
      })
    })
  })
})
