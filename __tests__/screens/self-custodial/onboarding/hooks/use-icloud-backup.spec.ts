import { renderHook } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useICloudBackup } from "@app/screens/self-custodial/onboarding/hooks/use-icloud-backup"
import { CloudBackupErrorReason } from "@app/types/cloud-backup"

loadLocale("en")
const LL = i18nObject("en")

/** icloud-client pulls in the native react-native-cloud-storage module; resolveErrorMessage
 *  never calls any of these, so a full stub keeps the test off the native bridge. */
jest.mock("@app/utils/icloud-client", () => ({
  assertICloudAvailable: jest.fn(),
  downloadAppDataFile: jest.fn(),
  findAppDataFile: jest.fn(),
  listAppDataFiles: jest.fn(),
  uploadAppDataFile: jest.fn(),
  ICloudError: class ICloudError extends Error {
    constructor(
      readonly reason: string,
      message: string,
    ) {
      super(message)
    }
  },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
}))

describe("useICloudBackup", () => {
  describe("resolveErrorMessage", () => {
    const resolve = (reason: CloudBackupErrorReason) => {
      const { result } = renderHook(() => useICloudBackup())
      return result.current.resolveErrorMessage(reason, LL)
    }

    const genericMessage = LL.BackupScreen.CloudBackup.signInFailed({
      provider: LL.BackupScreen.BackupMethod.appleICloud(),
    })

    /** iOS has no storageAccessRequired analogue, so a withheld permission intentionally lands
     *  on the generic sign-in message rather than a Drive-specific one. */
    it("falls back to the generic sign-in message for a permission-denied reason", () => {
      expect(resolve(CloudBackupErrorReason.PermissionDenied)).toBe(genericMessage)
    })

    /** Cancellation is the user's own action; the generic message is the intended catch-all. */
    it("falls back to the generic sign-in message for a cancelled reason", () => {
      expect(resolve(CloudBackupErrorReason.Cancelled)).toBe(genericMessage)
    })
  })
})
