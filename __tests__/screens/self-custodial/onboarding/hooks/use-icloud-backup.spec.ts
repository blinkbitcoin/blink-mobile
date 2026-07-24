import { renderHook, act } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useICloudBackup } from "@app/screens/self-custodial/onboarding/hooks/use-icloud-backup"
import { CloudBackupErrorReason } from "@app/types/cloud-backup"

loadLocale("en")
const LL = i18nObject("en")

const mockAssertICloudAvailable = jest.fn()
const mockFindAppDataFile = jest.fn()
const mockUploadAppDataFile = jest.fn()
const mockDownloadAppDataFile = jest.fn()
const mockListAppDataFiles = jest.fn()

jest.mock("@app/utils/icloud-client", () => {
  const actual = jest.requireActual("@app/utils/icloud-client")
  return {
    ...actual,
    assertICloudAvailable: () => mockAssertICloudAvailable(),
    findAppDataFile: (...args: readonly unknown[]) => mockFindAppDataFile(...args),
    uploadAppDataFile: (...args: readonly unknown[]) => mockUploadAppDataFile(...args),
    downloadAppDataFile: (...args: readonly unknown[]) =>
      mockDownloadAppDataFile(...args),
    listAppDataFiles: (...args: readonly unknown[]) => mockListAppDataFiles(...args),
  }
})

const mockRecordError = jest.fn()
const mockCrashlyticsLog = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: readonly unknown[]) => mockRecordError(...args),
  log: (...args: readonly unknown[]) => mockCrashlyticsLog(...args),
}))

const { ICloudError } = jest.requireActual(
  "@app/utils/icloud-client",
) as typeof import("@app/utils/icloud-client")

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

  describe("error reporting", () => {
    const session = { accessToken: "icloud", existingFileId: undefined }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it("does not record when the device is not signed into iCloud (Auth = user state)", async () => {
      mockAssertICloudAvailable.mockRejectedValueOnce(
        new ICloudError(CloudBackupErrorReason.Auth, "iCloud is not available"),
      )

      const { result } = renderHook(() => useICloudBackup())

      let sessionResult:
        | Awaited<ReturnType<typeof result.current.startSession>>
        | undefined
      await act(async () => {
        sessionResult = await result.current.startSession("backup.json")
      })

      expect(sessionResult).toEqual({
        success: false,
        reason: CloudBackupErrorReason.Auth,
      })
      expect(mockRecordError).not.toHaveBeenCalled()
      expect(mockCrashlyticsLog).toHaveBeenCalledWith(
        expect.stringContaining("[expected]"),
      )
    })

    it("downgrades transient iCloud errors to a breadcrumb", async () => {
      mockUploadAppDataFile.mockRejectedValueOnce(
        new ICloudError(CloudBackupErrorReason.Transient, "iCloud request rate limited"),
      )

      const { result } = renderHook(() => useICloudBackup())

      let uploadResult: Awaited<ReturnType<typeof result.current.upload>> | undefined
      await act(async () => {
        uploadResult = await result.current.upload("{}", "backup.json", session)
      })

      expect(uploadResult).toEqual({
        success: false,
        reason: CloudBackupErrorReason.Transient,
      })
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it("records unknown ICloudErrors as defects, preserving the instance", async () => {
      const original = new ICloudError(
        CloudBackupErrorReason.Unknown,
        "iCloud query failed: malformed response",
      )
      mockUploadAppDataFile.mockRejectedValueOnce(original)

      const { result } = renderHook(() => useICloudBackup())

      await act(async () => {
        await result.current.upload("{}", "backup.json", session)
      })

      expect(mockRecordError).toHaveBeenCalledWith(original)
    })

    it("wraps non-ICloudError failures with operation context", async () => {
      mockDownloadAppDataFile.mockRejectedValueOnce(new Error("plain JS error"))

      const { result } = renderHook(() => useICloudBackup())

      await act(async () => {
        await result.current.downloadById("file-1", "icloud")
      })

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "iCloud download failed: plain JS error" }),
      )
    })
  })
})
