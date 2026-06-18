import { renderHook, act } from "@testing-library/react-native"

import BiometricWrapper from "@app/utils/biometricAuthentication"

import { useBiometricGate } from "@app/screens/card-screen/hooks/use-biometric-gate"

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: jest.fn(),
    authenticate: jest.fn(),
  },
}))

const mockIsSensorAvailable = BiometricWrapper.isSensorAvailable as jest.Mock
const mockAuthenticate = BiometricWrapper.authenticate as jest.Mock

describe("useBiometricGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
