import BiometricWrapper, {
  EXPECTED_BIOMETRIC_ERROR_NAMES,
  isExpectedBiometricError,
} from "@app/utils/biometricAuthentication"

const mockIsSensorAvailable = jest.fn()
const mockAuthenticate = jest.fn()
const mockRelease = jest.fn()

jest.mock("react-native-fingerprint-scanner", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: () => mockIsSensorAvailable(),
    authenticate: (...args: unknown[]) => mockAuthenticate(...args),
    release: () => mockRelease(),
  },
}))

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

const namedError = (name: string, message = name): Error =>
  Object.assign(new Error(message), { name })

describe("isExpectedBiometricError", () => {
  EXPECTED_BIOMETRIC_ERROR_NAMES.forEach((name) => {
    it(`treats ${name} as an expected device/user state`, () => {
      expect(isExpectedBiometricError(namedError(name))).toBe(true)
    })
  })

  it("matches when the name only appears in the message", () => {
    expect(
      isExpectedBiometricError(new Error("FingerprintScannerNotEnrolled")),
    ).toBe(true)
  })

  it("keeps genuine sensor faults as defects", () => {
    expect(isExpectedBiometricError(namedError("HardwareError"))).toBe(false)
    expect(
      isExpectedBiometricError(namedError("FingerprintScannerUnknownError")),
    ).toBe(false)
  })
})

describe("BiometricWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "debug").mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("isSensorAvailable", () => {
    it("does not record expected states like no enrolled biometrics", async () => {
      mockIsSensorAvailable.mockRejectedValue(
        namedError("FingerprintScannerNotEnrolled", "no enrolled fingers"),
      )

      await expect(BiometricWrapper.isSensorAvailable()).resolves.toBe(false)

      expect(mockRecordError).not.toHaveBeenCalled()
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("[expected]"))
    })

    it("records genuine sensor faults", async () => {
      mockIsSensorAvailable.mockRejectedValue(namedError("HardwareError", "sensor dead"))

      await expect(BiometricWrapper.isSensorAvailable()).resolves.toBe(false)

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "sensor dead" }),
      )
    })
  })

  describe("authenticate", () => {
    it("does not record user cancellations but still calls handleFailure", async () => {
      mockAuthenticate.mockRejectedValue(namedError("UserCancel", "user cancelled"))
      const handleSuccess = jest.fn()
      const handleFailure = jest.fn()

      await BiometricWrapper.authenticate("auth", handleSuccess, handleFailure)

      expect(handleFailure).toHaveBeenCalled()
      expect(handleSuccess).not.toHaveBeenCalled()
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it("records unexpected authentication failures", async () => {
      mockAuthenticate.mockRejectedValue(
        namedError("FingerprintScannerUnknownError", "boom"),
      )
      const handleFailure = jest.fn()

      await BiometricWrapper.authenticate("auth", jest.fn(), handleFailure)

      expect(handleFailure).toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "boom" }),
      )
    })
  })
})
