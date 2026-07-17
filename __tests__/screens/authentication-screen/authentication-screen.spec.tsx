import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { AuthenticationScreen } from "@app/screens/authentication-screen/authentication-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "@app/utils/enum"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RouteProp } from "@react-navigation/native"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

/** The app loads the catalogue at boot; without it every label renders empty and the
 *  buttons become indistinguishable. */
loadLocale("en")

const mockReplace = jest.fn()
const mockGoBack = jest.fn()
const mockNavigate = jest.fn()
const mockSetAppUnlocked = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    replace: mockReplace,
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: jest.fn() }),
}))

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: { authenticate: jest.fn() },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    resetPinAttempts: jest.fn(),
    setIsBiometricsEnabled: jest.fn(),
    /** Read by the account registry the screen renders under. */
    getSessionProfiles: jest.fn().mockResolvedValue([]),
  },
}))

const mockedBiometrics = jest.mocked(BiometricWrapper)

const buildRoute = (
  isResume?: boolean,
): RouteProp<RootStackParamList, "authentication"> =>
  ({
    key: "authentication",
    name: "authentication",
    params: {
      screenPurpose: AuthenticationScreenPurpose.Authenticate,
      isPinEnabled: true,
      isResume,
    },
  }) as RouteProp<RootStackParamList, "authentication">

const renderScreen = (isResume?: boolean) =>
  render(
    <ContextForScreen>
      <AuthenticationScreen route={buildRoute(isResume)} />
    </ContextForScreen>,
  )

describe("AuthenticationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  it("treats a missing resume flag as a cold start", async () => {
    renderScreen(undefined)
    await flushEffects()

    expect(mockReplace).toHaveBeenCalledWith("Primary")
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("leaves the user on the lock when the prompt is not passed", async () => {
    mockedBiometrics.authenticate.mockImplementation(async () => {})
    renderScreen(true)
    await flushEffects()

    expect(mockSetAppUnlocked).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
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
