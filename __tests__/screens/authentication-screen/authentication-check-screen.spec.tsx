import React from "react"
import { render } from "@testing-library/react-native"

import { AuthenticationCheckScreen } from "@app/screens/authentication-screen/authentication-check-screen"
import { updateDeviceSessionCount } from "@app/graphql/client-only-query"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "@app/utils/enum"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

const mockReplace = jest.fn()
const mockGoBack = jest.fn()
const mockSetAppUnlocked = jest.fn()

let mockRouteParams: { isResume?: boolean } | undefined

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ replace: mockReplace, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateDeviceSessionCount: jest.fn(),
}))

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: { isSensorAvailable: jest.fn() },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getIsPinEnabled: jest.fn(),
    getIsBiometricsEnabled: jest.fn(),
    /** Read by the account registry the screen renders under. */
    getSessionProfiles: jest.fn().mockResolvedValue([]),
  },
}))

const mockedKeyStore = jest.mocked(KeyStoreWrapper)
const mockedBiometrics = jest.mocked(BiometricWrapper)

const renderScreen = () =>
  render(
    <ContextForScreen>
      <AuthenticationCheckScreen />
    </ContextForScreen>,
  )

const setLock = ({
  pin,
  biometrics,
  sensor = true,
}: {
  pin: boolean
  biometrics: boolean
  sensor?: boolean
}) => {
  mockedKeyStore.getIsPinEnabled.mockResolvedValue(pin)
  mockedKeyStore.getIsBiometricsEnabled.mockResolvedValue(biometrics)
  mockedBiometrics.isSensorAvailable.mockResolvedValue(sensor)
}

describe("AuthenticationCheckScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams = undefined
    setLock({ pin: true, biometrics: false })
  })

  describe("carrying the resume flag to the unlock screen", () => {
    it("marks the biometric screen as a resume", async () => {
      setLock({ pin: true, biometrics: true })
      mockRouteParams = { isResume: true }
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("authentication", {
        screenPurpose: AuthenticationScreenPurpose.Authenticate,
        isPinEnabled: true,
        isResume: true,
      })
    })

    it("marks the pin screen as a resume", async () => {
      mockRouteParams = { isResume: true }
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.AuthenticatePin,
        isResume: true,
      })
    })

    it("leaves a cold start unmarked", async () => {
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.AuthenticatePin,
        isResume: false,
      })
    })
  })

  describe("with no lock configured", () => {
    it("opens the home screen and counts the session on a cold start", async () => {
      setLock({ pin: false, biometrics: false })
      renderScreen()
      await flushEffects()

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(updateDeviceSessionCount).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("Primary")
    })

    it("steps back on a resume whose lock was turned off, opening no session", async () => {
      setLock({ pin: false, biometrics: false })
      mockRouteParams = { isResume: true }
      renderScreen()
      await flushEffects()

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(updateDeviceSessionCount).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  it("keeps the pin screen when the sensor is unavailable, even with biometrics on", async () => {
    setLock({ pin: true, biometrics: true, sensor: false })
    renderScreen()
    await flushEffects()

    expect(mockReplace).toHaveBeenCalledWith("pin", {
      screenPurpose: PinScreenPurpose.AuthenticatePin,
      isResume: false,
    })
  })
})
