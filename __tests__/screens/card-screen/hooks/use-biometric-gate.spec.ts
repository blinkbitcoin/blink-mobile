import { renderHook, act } from "@testing-library/react-native"

import BiometricWrapper from "@app/utils/biometricAuthentication"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { useBiometricGate } from "@app/screens/card-screen/hooks/use-biometric-gate"

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
    readIsBiometricsEnabled: jest.fn(),
  },
}))

const mockIsSensorAvailable = BiometricWrapper.isSensorAvailable as jest.Mock
const mockAuthenticate = BiometricWrapper.authenticate as jest.Mock
const mockReadIsBiometricsEnabled = KeyStoreWrapper.readIsBiometricsEnabled as jest.Mock

/** The gate fails closed: only a definite `no` skips the prompt. */
const biometricsSetting = (isEnabled: boolean) => ({
  status: isEnabled ? "yes" : "no",
})

describe("useBiometricGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /** This gate stands in front of the recovery phrase. A store that cannot
   *  answer must not be read as "biometrics off" and waved through. */
  it("prompts rather than waving through when the setting cannot be read", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue({
      status: "failed",
      err: new Error("keystore locked"),
    })
    mockIsSensorAvailable.mockResolvedValue(true)

    const onFailure = jest.fn()
    renderHook(() =>
      useBiometricGate({
        description: "test",
        onFailure,
        onlyIfBiometricsEnabled: true,
      }),
    )

    await act(async () => {})

    expect(mockAuthenticate).toHaveBeenCalled()
  })

  /** The pre-first-unlock window makes the setting unreadable. Waving the user
   *  through because the sensor is also unavailable would score that unreadable
   *  setting as "no gate needed", which is the mistake the short-circuit above
   *  exists to prevent. */
  it("calls onFailure when the setting cannot be read and the sensor is unavailable", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue({
      status: "failed",
      err: new Error("keystore locked"),
    })
    mockIsSensorAvailable.mockResolvedValue(false)

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({
        description: "test",
        onFailure,
        onlyIfBiometricsEnabled: true,
      }),
    )

    await act(async () => {})

    expect(onFailure).toHaveBeenCalled()
    expect(result.current).toBe(false)
  })

  /** The counterpart: a readable setting keeps the old behaviour, so a device
   *  whose sensor is genuinely gone is not locked out of its own screen. */
  it("still authenticates when the setting reads on and the sensor is unavailable", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue(biometricsSetting(true))
    mockIsSensorAvailable.mockResolvedValue(false)

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({
        description: "test",
        onFailure,
        onlyIfBiometricsEnabled: true,
      }),
    )

    await act(async () => {})

    expect(onFailure).not.toHaveBeenCalled()
    expect(result.current).toBe(true)
  })

  it("sets authenticated true when sensor not available and required false", async () => {
    mockIsSensorAvailable.mockResolvedValue(false)

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure }),
    )

    await act(async () => {})

    expect(result.current).toBe(true)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("calls onFailure when sensor not available and required true", async () => {
    mockIsSensorAvailable.mockResolvedValue(false)

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure, required: true }),
    )

    await act(async () => {})

    expect(result.current).toBe(false)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it("sets authenticated true on successful biometric auth", async () => {
    mockIsSensorAvailable.mockResolvedValue(true)
    mockAuthenticate.mockImplementation((_desc: string, onSuccess: () => void) => {
      onSuccess()
    })

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure }),
    )

    await act(async () => {})

    expect(result.current).toBe(true)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("calls onFailure when isSensorAvailable throws", async () => {
    mockIsSensorAvailable.mockRejectedValue(new Error("Permission denied"))

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure }),
    )

    await act(async () => {})

    expect(result.current).toBe(false)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it("calls onFailure on failed biometric auth", async () => {
    mockIsSensorAvailable.mockResolvedValue(true)
    mockAuthenticate.mockImplementation(
      (_desc: string, _onSuccess: () => void, onFail: () => void) => {
        onFail()
      },
    )

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure }),
    )

    await act(async () => {})

    expect(result.current).toBe(false)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it("does not consult the biometrics setting when onlyIfBiometricsEnabled is omitted", async () => {
    mockIsSensorAvailable.mockResolvedValue(true)
    mockAuthenticate.mockImplementation((_desc: string, onSuccess: () => void) => {
      onSuccess()
    })

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure }),
    )

    await act(async () => {})

    expect(result.current).toBe(true)
    expect(mockReadIsBiometricsEnabled).not.toHaveBeenCalled()
  })

  it("skips the prompt and authenticates when onlyIfBiometricsEnabled and setting is off", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue(biometricsSetting(false))

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure, onlyIfBiometricsEnabled: true }),
    )

    await act(async () => {})

    expect(result.current).toBe(true)
    expect(mockIsSensorAvailable).not.toHaveBeenCalled()
    expect(mockAuthenticate).not.toHaveBeenCalled()
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("prompts and authenticates when onlyIfBiometricsEnabled and setting is on", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue(biometricsSetting(true))
    mockIsSensorAvailable.mockResolvedValue(true)
    mockAuthenticate.mockImplementation((_desc: string, onSuccess: () => void) => {
      onSuccess()
    })

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure, onlyIfBiometricsEnabled: true }),
    )

    await act(async () => {})

    expect(result.current).toBe(true)
    expect(mockAuthenticate).toHaveBeenCalledTimes(1)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("calls onFailure when onlyIfBiometricsEnabled and biometric auth fails", async () => {
    mockReadIsBiometricsEnabled.mockResolvedValue(biometricsSetting(true))
    mockIsSensorAvailable.mockResolvedValue(true)
    mockAuthenticate.mockImplementation(
      (_desc: string, _onSuccess: () => void, onFail: () => void) => {
        onFail()
      },
    )

    const onFailure = jest.fn()
    const { result } = renderHook(() =>
      useBiometricGate({ description: "test", onFailure, onlyIfBiometricsEnabled: true }),
    )

    await act(async () => {})

    expect(result.current).toBe(false)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })
})
