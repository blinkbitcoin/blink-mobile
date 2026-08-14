import { renderHook, act } from "@testing-library/react-native"

import {
  useAuthGateFailureHandler,
  useLocalAuthGate,
} from "@app/hooks/use-local-auth-gate"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import { PinScreenPurpose } from "@app/utils/enum"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { toastShow } from "@app/utils/toast"

const mockPush = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ push: mockPush, goBack: mockGoBack }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

/** The failure handler only hands LL through to the (mocked) toast. */
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: {} }),
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
  const call = mockPush.mock.calls.find(([routeName]) => routeName === "pin")
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
      expect(onFailure).toHaveBeenCalledWith("noFactor")
      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
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
      expect(mockPush).not.toHaveBeenCalled()
    })

    it("falls back to the pin challenge when the prompt fails and a pin exists", async () => {
      arrangeFactors({ pin: true, biometrics: true })
      biometricPromptResolves("failure")

      const { result, onFailure } = renderGate()
      await settle()

      expect(mockPush).toHaveBeenCalledWith(
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
      expect(onFailure).toHaveBeenCalledWith("declined")
    })

    it("fails when the prompt fails and no pin exists", async () => {
      arrangeFactors({ pin: false, biometrics: true })
      biometricPromptResolves("failure")

      const { result, onFailure } = renderGate()
      await settle()

      expect(result.current).toBe(false)
      expect(onFailure).toHaveBeenCalledTimes(1)
      expect(onFailure).toHaveBeenCalledWith("unavailable")
      expect(mockPush).not.toHaveBeenCalled()
    })

    it("skips straight to the pin challenge when the sensor is unavailable", async () => {
      arrangeFactors({ pin: true, biometrics: true })
      mockIsSensorAvailable.mockResolvedValue(false)

      renderGate()
      await settle()

      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith(
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
      expect(onFailure).toHaveBeenCalledWith("unavailable")
    })

    it("treats a sensor probe error as a missing sensor", async () => {
      arrangeFactors({ pin: true, biometrics: true })
      mockIsSensorAvailable.mockRejectedValue(new Error("sensor exploded"))

      const { onFailure } = renderGate()
      await settle()

      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith(
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
      expect(mockPush).toHaveBeenCalledWith(
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

  describe("unmounted while the gate is still initiating", () => {
    /** The mounted flag must gate initiation, not just result callbacks: a caller
     *  popped mid-flight must not be challenged (or prompted) over its successor. */
    it("does not challenge when the factor reads settle after unmount", async () => {
      let resolvePin!: (value: boolean) => void
      mockGetIsPinEnabled.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolvePin = resolve
        }),
      )
      mockGetIsBiometricsEnabled.mockResolvedValue(false)

      const { unmount, onFailure } = renderGate()
      unmount()
      await act(async () => resolvePin(true))

      expect(mockPush).not.toHaveBeenCalled()
      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(onFailure).not.toHaveBeenCalled()
    })

    it("does not report a required gate's no-factor failure after unmount", async () => {
      let resolvePin!: (value: boolean) => void
      mockGetIsPinEnabled.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolvePin = resolve
        }),
      )
      mockGetIsBiometricsEnabled.mockResolvedValue(false)

      const { unmount, onFailure } = renderGate()
      unmount()
      await act(async () => resolvePin(false))

      expect(onFailure).not.toHaveBeenCalled()
    })

    it("stays quiet when the keystore read rejects after unmount", async () => {
      let rejectPin!: (error: Error) => void
      mockGetIsPinEnabled.mockReturnValue(
        new Promise<boolean>((_resolve, reject) => {
          rejectPin = reject
        }),
      )
      mockGetIsBiometricsEnabled.mockResolvedValue(false)

      const { unmount, onFailure } = renderGate()
      unmount()
      await act(async () => rejectPin(new Error("keystore gone")))

      expect(onFailure).not.toHaveBeenCalled()
    })

    it("does not prompt when the sensor probe settles after unmount", async () => {
      arrangeFactors({ pin: true, biometrics: true })
      let resolveSensor!: (value: boolean) => void
      mockIsSensorAvailable.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveSensor = resolve
        }),
      )

      const { unmount, onFailure } = renderGate()
      await settle()
      unmount()
      await act(async () => resolveSensor(true))

      expect(mockAuthenticate).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(onFailure).not.toHaveBeenCalled()
    })
  })

  it("fails closed when the keystore itself errors", async () => {
    mockGetIsPinEnabled.mockRejectedValue(new Error("keystore gone"))
    mockGetIsBiometricsEnabled.mockResolvedValue(false)

    const { result, onFailure } = renderGate()
    await settle()

    expect(result.current).toBe(false)
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith("unavailable")
  })
})

describe("useAuthGateFailureHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("explains and bounces when no factor is configured", () => {
    const { result } = renderHook(() => useAuthGateFailureHandler())

    act(() => result.current("noFactor"))

    expect(toastShow).toHaveBeenCalledTimes(1)
    expect(mockGoBack).toHaveBeenCalledTimes(1)

    /** The toast copy is wired to the shared (non-card) namespace. */
    const { message } = (toastShow as jest.Mock).mock.calls[0][0]
    loadLocale("en")
    expect(message(i18nObject("en"))).toBe(
      "Authentication is required. You can set up a PIN or biometrics in Security settings.",
    )
  })

  it("explains and bounces when a configured factor cannot be satisfied", () => {
    const { result } = renderHook(() => useAuthGateFailureHandler())

    act(() => result.current("unavailable"))

    expect(toastShow).toHaveBeenCalledTimes(1)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("bounces silently on a deliberate decline", () => {
    const { result } = renderHook(() => useAuthGateFailureHandler())

    act(() => result.current("declined"))

    expect(toastShow).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })
})
