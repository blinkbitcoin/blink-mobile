import FingerprintScanner from "react-native-fingerprint-scanner"

import { recordAppError } from "@app/utils/error-reporting"

// react-native-fingerprint-scanner rejection names that are expected device/user
// states (nothing enrolled, user cancelled, device locked, plain mismatch) rather
// than sensor defects.
export const EXPECTED_BIOMETRIC_ERROR_NAMES: readonly string[] = [
  "FingerprintScannerNotEnrolled",
  "FingerprintScannerNotAvailable",
  "FingerprintScannerNotSupported",
  "UserCancel",
  "UserFallback",
  "SystemCancel",
  "PasscodeNotSet",
  "DeviceLocked",
  "DeviceLockedPermanent",
  "AuthenticationNotMatch",
  "AuthenticationFailed",
  "AuthenticationTimeout",
  "AuthenticationProcessFailed",
]

const matchesErrorName = (err: Error, name: string): boolean =>
  err.name === name || err.message.includes(name)

export const isExpectedBiometricError = (err: Error): boolean =>
  EXPECTED_BIOMETRIC_ERROR_NAMES.some((name) => matchesErrorName(err, name))

/** The rejection a device with a sensor but nothing enrolled answers the probe
 *  with. It is the one probe failure the user can act on themselves. */
const NOT_ENROLLED_ERROR_NAME = "FingerprintScannerNotEnrolled"

/**
 * Why the sensor cannot be used, for the callers that say something different
 * about each. `notEnrolled` is advice — go enrol a finger or a face;
 * `unavailable` is not, and covers both a device with no sensor and a probe
 * that failed for any other reason.
 */
export type SensorAvailability = "available" | "notEnrolled" | "unavailable"

export default class BiometricWrapper {
  private static isHandlingAuthenticate = false

  /**
   * The probe's full answer. It exists because `isSensorAvailable` collapses
   * "no sensor" and "nothing enrolled" into one `false`, which is how a device
   * with a working sensor and no enrolment gets told it has no sensor.
   *
   * Never rejects: every caller of the boolean form treats a throw as false
   * already, and a probe that cannot answer is not a reason to fail louder than
   * a probe that answers no.
   */
  public static async readSensorAvailability(): Promise<SensorAvailability> {
    try {
      const biometryType = await FingerprintScanner.isSensorAvailable()
      return biometryType === null ? "unavailable" : "available"
    } catch (err: unknown) {
      if (err instanceof Error) {
        recordAppError(err, { expected: isExpectedBiometricError(err) })
        if (matchesErrorName(err, NOT_ENROLLED_ERROR_NAME)) return "notEnrolled"
      }
      return "unavailable"
    }
  }

  /** Whether the sensor can be prompted at all. Unchanged for its callers: only
   *  `available` is true, exactly as before. */
  public static async isSensorAvailable(): Promise<boolean> {
    return (await BiometricWrapper.readSensorAvailability()) === "available"
  }

  public static async authenticate(
    description: string,
    handleSuccess: () => void,
    handleFailure: () => void,
  ): Promise<void> {
    /** A dropped call still has to answer. Returning silently leaves a caller
     *  that has no other completion path waiting forever — `useLocalAuthGate`
     *  renders its spinner until one of these two fires — and the honest answer
     *  for a prompt that never ran is failure, which every caller already
     *  handles as "fall through to the next factor". */
    if (this.isHandlingAuthenticate) {
      handleFailure()
      return
    }
    this.isHandlingAuthenticate = true

    try {
      FingerprintScanner.release()
      await FingerprintScanner.authenticate({
        description,
        // The library's iOS policy is hardcoded biometric-only
        // (deviceOwnerAuthenticationWithBiometrics), so this flag only controls
        // whether a fallback BUTTON renders — one whose tap can only ever reject
        // with UserFallback. Don't offer a button that always fails; the pin
        // fallback lives in useLocalAuthGate instead. Android ignores the flag.
        fallbackEnabled: false,
      })

      handleSuccess()
    } catch (err: unknown) {
      if (err instanceof Error) {
        recordAppError(err, { expected: isExpectedBiometricError(err) })
      }
      console.debug({ err }, "error during biometric authentication")
      handleFailure()
    } finally {
      FingerprintScanner.release()
      this.isHandlingAuthenticate = false
    }
  }
}
