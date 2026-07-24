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

export const isExpectedBiometricError = (err: Error): boolean =>
  EXPECTED_BIOMETRIC_ERROR_NAMES.some(
    (name) => err.name === name || err.message.includes(name),
  )

export default class BiometricWrapper {
  private static isHandlingAuthenticate = false

  public static async isSensorAvailable(): Promise<boolean> {
    try {
      const biometryType = await FingerprintScanner.isSensorAvailable()
      return biometryType !== null
    } catch (err: unknown) {
      if (err instanceof Error) {
        recordAppError(err, { expected: isExpectedBiometricError(err) })
      }
      return false
    }
  }

  public static async authenticate(
    description: string,
    handleSuccess: () => void,
    handleFailure: () => void,
  ): Promise<void> {
    if (this.isHandlingAuthenticate) return
    this.isHandlingAuthenticate = true

    try {
      FingerprintScanner.release()
      await FingerprintScanner.authenticate({
        description,
        fallbackEnabled: true,
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
