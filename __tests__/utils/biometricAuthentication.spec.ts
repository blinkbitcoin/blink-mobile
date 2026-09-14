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
    expect(isExpectedBiometricError(new Error("FingerprintScannerNotEnrolled"))).toBe(
      true,
    )
  })

  it("keeps genuine sensor faults as defects", () => {
    expect(isExpectedBiometricError(namedError("HardwareError"))).toBe(false)
    expect(isExpectedBiometricError(namedError("FingerprintScannerUnknownError"))).toBe(
      false,
    )
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

    it("is true only for a sensor that can actually be prompted", async () => {
      mockIsSensorAvailable.mockResolvedValue("TouchID")
      await expect(BiometricWrapper.isSensorAvailable()).resolves.toBe(true)

      mockIsSensorAvailable.mockResolvedValue(null)
      await expect(BiometricWrapper.isSensorAvailable()).resolves.toBe(false)
    })
  })

  /**
   * The boolean above answers false for a device with no sensor and for a device
   * whose sensor has nothing enrolled, which is how the second one gets told it
   * has no sensor. This is the answer that tells them apart.
   */
  describe("readSensorAvailability", () => {
    it("reports a usable sensor as available", async () => {
      mockIsSensorAvailable.mockResolvedValue("FaceID")

      await expect(BiometricWrapper.readSensorAvailability()).resolves.toBe("available")
    })

    it("reports a device with no sensor as unavailable", async () => {
      mockIsSensorAvailable.mockResolvedValue(null)

      await expect(BiometricWrapper.readSensorAvailability()).resolves.toBe("unavailable")
    })

    it("reports a sensor with nothing enrolled as notEnrolled, not as missing", async () => {
      mockIsSensorAvailable.mockRejectedValue(
        namedError("FingerprintScannerNotEnrolled", "no enrolled fingers"),
      )

      await expect(BiometricWrapper.readSensorAvailability()).resolves.toBe("notEnrolled")
    })

    it("recognises the enrolment rejection by message when the name is generic", async () => {
      mockIsSensorAvailable.mockRejectedValue(
        new Error("FingerprintScannerNotEnrolled: enrol something"),
      )

      await expect(BiometricWrapper.readSensorAvailability()).resolves.toBe("notEnrolled")
    })

    it("reports every other rejection as unavailable rather than guessing", async () => {
      mockIsSensorAvailable.mockRejectedValue(namedError("HardwareError", "sensor dead"))

      await expect(BiometricWrapper.readSensorAvailability()).resolves.toBe("unavailable")
    })

    it("reports a rejection that is not an Error as unavailable, and never throws", async () => {
      mockIsSensorAvailable.mockRejectedValue("not even an error")

      await expect(BiometricWrapper.readSensorAvailability()).resolves.toBe("unavailable")
    })

    it("keeps the reporting split the boolean form had", async () => {
      mockIsSensorAvailable.mockRejectedValue(
        namedError("FingerprintScannerNotEnrolled", "no enrolled fingers"),
      )
      await BiometricWrapper.readSensorAvailability()
      expect(mockRecordError).not.toHaveBeenCalled()

      mockIsSensorAvailable.mockRejectedValue(namedError("HardwareError", "sensor dead"))
      await BiometricWrapper.readSensorAvailability()
      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "sensor dead" }),
      )
    })
  })

  describe("authenticate", () => {
    it("does not offer the OS fallback button, which could only ever fail", async () => {
      mockAuthenticate.mockResolvedValue(undefined)

      await BiometricWrapper.authenticate("auth", jest.fn(), jest.fn())

      expect(mockAuthenticate).toHaveBeenCalledWith(
        expect.objectContaining({ fallbackEnabled: false }),
      )
    })

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

    /**
     * Only one prompt can be up at a time, so a second call is dropped. It still
     * has to answer: a caller whose only completion path is these two callbacks
     * waits forever otherwise, which is how a gated screen ends up on a spinner
     * that never resolves.
     */
    describe("a call that arrives while a prompt is already up", () => {
      /** Holds the first prompt open so the second call lands mid-flight. */
      const promptHeldOpen = () => {
        let release = () => {}
        mockAuthenticate.mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              release = resolve
            }),
        )
        return () => release()
      }

      it("reports failure instead of returning silently", async () => {
        const release = promptHeldOpen()
        const firstSuccess = jest.fn()
        const inFlight = BiometricWrapper.authenticate("auth", firstSuccess, jest.fn())

        const handleSuccess = jest.fn()
        const handleFailure = jest.fn()
        await BiometricWrapper.authenticate("auth", handleSuccess, handleFailure)

        expect(handleFailure).toHaveBeenCalledTimes(1)
        expect(handleSuccess).not.toHaveBeenCalled()

        release()
        await inFlight
      })

      it("does not disturb the prompt already running", async () => {
        const release = promptHeldOpen()
        const firstSuccess = jest.fn()
        const inFlight = BiometricWrapper.authenticate("auth", firstSuccess, jest.fn())

        await BiometricWrapper.authenticate("auth", jest.fn(), jest.fn())

        // One prompt was opened, not two, and the dropped call did not release it.
        expect(mockAuthenticate).toHaveBeenCalledTimes(1)

        release()
        await inFlight
        expect(firstSuccess).toHaveBeenCalledTimes(1)
      })

      it("accepts a fresh call once the first has finished", async () => {
        const release = promptHeldOpen()
        const inFlight = BiometricWrapper.authenticate("auth", jest.fn(), jest.fn())
        release()
        await inFlight

        mockAuthenticate.mockResolvedValue(undefined)
        const handleSuccess = jest.fn()
        const handleFailure = jest.fn()
        await BiometricWrapper.authenticate("auth", handleSuccess, handleFailure)

        expect(handleSuccess).toHaveBeenCalledTimes(1)
        expect(handleFailure).not.toHaveBeenCalled()
      })
    })
  })
})
