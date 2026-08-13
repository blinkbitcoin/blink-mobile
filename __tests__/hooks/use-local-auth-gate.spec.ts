import { renderHook, act } from "@testing-library/react-native"

import { useLocalAuthGate } from "@app/hooks/use-local-auth-gate"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import { PinScreenPurpose } from "@app/utils/enum"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: jest.fn(),
    authenticate: jest.fn(),
  },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getIsPinEnabled: jest.fn(),
    getIsBiometricsEnabled: jest.fn(),
  },
}))

const mockIsSensorAvailable = BiometricWrapper.isSensorAvailable as jest.Mock
const mockAuthenticate = BiometricWrapper.authenticate as jest.Mock
const mockGetIsPinEnabled = KeyStoreWrapper.getIsPinEnabled as jest.Mock
const mockGetIsBiometricsEnabled = KeyStoreWrapper.getIsBiometricsEnabled as jest.Mock

const arrangeFactors = ({ pin, biometrics }: { pin: boolean; biometrics: boolean }) => {
  mockGetIsPinEnabled.mockResolvedValue(pin)
  mockGetIsBiometricsEnabled.mockResolvedValue(biometrics)
}

const biometricPromptResolves = (outcome: "success" | "failure") =>
  mockAuthenticate.mockImplementation(
    async (_description: string, onSuccess: () => void, onFailure: () => void) => {
      ;(outcome === "success" ? onSuccess : onFailure)()
    },
  )

/** The pin challenge resolves through callbacks handed to the pin route; grab them. */
const capturedChallengeParams = () => {
  const call = mockNavigate.mock.calls.find(([routeName]) => routeName === "pin")
  return call?.[1]
}

const renderGate = (overrides: { required?: boolean } = {}) => {
  const onFailure = jest.fn()
  const rendered = renderHook(() =>
    useLocalAuthGate({ description: "test", onFailure, ...overrides }),
  )
  return { onFailure, ...rendered }
}

const settle = () => act(async () => {})

describe("useLocalAuthGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSensorAvailable.mockResolvedValue(true)
  })

  describe("no factor configured", () => {
    it("fails closed by default", async () => {
      arrangeFactors({ pin: false, biometrics: false })

      const { result, onFailure } = renderGate()
      await settle()

      expect(result.current).toBe(false)
      expect(onFailure).toHaveBeenCalledTimes(1)
      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("opens only on an explicit opt-out", async () => {
      arrangeFactors({ pin: false, biometrics: false })

      const { result, onFailure } = renderGate({ required: false })
      await settle()

      expect(result.current).toBe(true)
      expect(onFailure).not.toHaveBeenCalled()
    })
  })

  describe("biometrics enabled", () => {
    it("authenticates through the prompt", async () => {
      arrangeFactors({ pin: false, biometrics: true })
      biometricPromptResolves("success")

      const { result } = renderGate()
      await settle()

      expect(result.current).toBe(true)
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("falls back to the pin challenge when the prompt fails and a pin exists", async () => {
      arrangeFactors({ pin: true, biometrics: true })
      biometricPromptResolves("failure")

      const { result, onFailure } = renderGate()
      await settle()

      expect(mockNavigate).toHaveBeenCalledWith(
        "pin",
        expect.objectContaining({ screenPurpose: PinScreenPurpose.ChallengePin }),
      )
      expect(onFailure).not.toHaveBeenCalled()

      act(() => capturedChallengeParams().onChallengeSuccess())
      expect(result.current).toBe(true)
    })

    it("fails when the pin challenge is declined", async () => {
      arrangeFactors({ pin: true, biometrics: true })
      biometricPromptResolves("failure")

      const { result, onFailure } = renderGate()
      await settle()

      act(() => capturedChallengeParams().onChallengeFailure())

      expect(result.current).toBe(false)
      expect(onFailure).toHaveBeenCalledTimes(1)
    })

    it("fails when the prompt fails and no pin exists", async () => {
      arrangeFactors({ pin: false, biometrics: true })
      biometricPromptResolves("failure")

      const { result, onFailure } = renderGate()
      await settle()

      expect(result.current).toBe(false)
      expect(onFailure).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("skips straight to the pin challenge when the sensor is unavailable", async () => {
      arrangeFactors({ pin: true, biometrics: true })
      mockIsSensorAvailable.mockResolvedValue(false)

      renderGate()
      await settle()

      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith(
        "pin",
        expect.objectContaining({ screenPurpose: PinScreenPurpose.ChallengePin }),
      )
    })

    it("never opens on a missing sensor, even for an optional gate", async () => {
      /** The old gate's second fail-open: biometrics enabled but the sensor gone
       *  meant straight through. A configured factor is always enforced. */
      arrangeFactors({ pin: false, biometrics: true })
      mockIsSensorAvailable.mockResolvedValue(false)

      const { result, onFailure } = renderGate({ required: false })
      await settle()

      expect(result.current).toBe(false)
      expect(onFailure).toHaveBeenCalledTimes(1)
    })

    it("treats a sensor probe error as a missing sensor", async () => {
      arrangeFactors({ pin: true, biometrics: true })
      mockIsSensorAvailable.mockRejectedValue(new Error("sensor exploded"))

      const { onFailure } = renderGate()
      await settle()

      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith(
        "pin",
        expect.objectContaining({ screenPurpose: PinScreenPurpose.ChallengePin }),
      )
      expect(onFailure).not.toHaveBeenCalled()
    })
  })

  describe("pin only", () => {
    it("challenges the pin without ever touching the sensor", async () => {
      /** The old gate's first fail-open: biometrics off meant straight through,
       *  no matter that the user had deliberately set a pin. */
      arrangeFactors({ pin: true, biometrics: false })

      const { result } = renderGate()
      await settle()

      expect(mockIsSensorAvailable).not.toHaveBeenCalled()
      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith(
        "pin",
        expect.objectContaining({ screenPurpose: PinScreenPurpose.ChallengePin }),
      )

      act(() => capturedChallengeParams().onChallengeSuccess())
      expect(result.current).toBe(true)
    })
  })

  it("ignores challenge callbacks that land after unmount", async () => {
    arrangeFactors({ pin: true, biometrics: false })

    const { unmount, onFailure } = renderGate()
    await settle()
    const params = capturedChallengeParams()

    unmount()
    params.onChallengeSuccess()
    params.onChallengeFailure()

    expect(onFailure).not.toHaveBeenCalled()
  })

  it("fails closed when the keystore itself errors", async () => {
    mockGetIsPinEnabled.mockRejectedValue(new Error("keystore gone"))
    mockGetIsBiometricsEnabled.mockResolvedValue(false)

    const { result, onFailure } = renderGate()
    await settle()

    expect(result.current).toBe(false)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })
})
