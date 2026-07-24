import { renderHook, act } from "@testing-library/react-native"
import { Platform } from "react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useGoogleDriveBackup } from "@app/screens/self-custodial/onboarding/hooks/use-google-drive-backup"
import type { CloudBackupErrorReason } from "@app/types/cloud-backup"

loadLocale("en")
const LL = i18nObject("en")

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"

/** Mirrors the shape the library returns, which is what the scope check reads. */
const signInSuccess = (scopes: readonly string[] = [DRIVE_SCOPE]) => ({
  type: "success" as const,
  data: { scopes },
})

const mockConfigure = jest.fn()
const mockHasPlayServices = jest.fn(() => Promise.resolve(true))
const mockSignOut = jest.fn(() => Promise.resolve())
const mockSignIn = jest.fn((): Promise<unknown> => Promise.resolve(signInSuccess()))
const mockAddScopes = jest.fn(
  (..._args: readonly unknown[]): Promise<unknown> => Promise.resolve(signInSuccess()),
)
const mockGetTokens = jest.fn(() =>
  Promise.resolve({ accessToken: "test-access-token", idToken: "token" }),
)

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: (...args: readonly unknown[]) => mockConfigure(...args),
    hasPlayServices: () => mockHasPlayServices(),
    signOut: () => mockSignOut(),
    signIn: () => mockSignIn(),
    addScopes: (...args: readonly unknown[]) => mockAddScopes(...args),
    getTokens: () => mockGetTokens(),
  },
}))

const mockFindAppDataFile = jest.fn()
const mockUploadAppDataFile = jest.fn()
const mockDownloadAppDataFile = jest.fn()
const mockListAppDataFiles = jest.fn()

jest.mock("@app/utils/google-drive-client", () => {
  const actual = jest.requireActual("@app/utils/google-drive-client")
  return {
    ...actual,
    findAppDataFile: (...args: readonly unknown[]) => mockFindAppDataFile(...args),
    uploadAppDataFile: (...args: readonly unknown[]) => mockUploadAppDataFile(...args),
    downloadAppDataFile: (...args: readonly unknown[]) =>
      mockDownloadAppDataFile(...args),
    listAppDataFiles: (...args: readonly unknown[]) => mockListAppDataFiles(...args),
  }
})

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: readonly unknown[]) => mockRecordError(...args),
}))

const { DriveError } = jest.requireActual(
  "@app/utils/google-drive-client",
) as typeof import("@app/utils/google-drive-client")
const { CloudBackupErrorReason: DriveErrorReason } = jest.requireActual(
  "@app/types/cloud-backup",
) as typeof import("@app/types/cloud-backup")

describe("useGoogleDriveBackup", () => {
  /** clearAllMocks leaves queued *Once values behind, so an unconsumed one would be served
   *  to the next test. Reset drains them, which means re-declaring every default here. */
  beforeEach(() => {
    jest.resetAllMocks()
    mockHasPlayServices.mockResolvedValue(true)
    mockSignOut.mockResolvedValue(undefined)
    mockSignIn.mockResolvedValue(signInSuccess())
    mockAddScopes.mockResolvedValue(signInSuccess())
    mockGetTokens.mockResolvedValue({
      accessToken: "test-access-token",
      idToken: "token",
    })
  })

  it("returns initial state", () => {
    const { result } = renderHook(() => useGoogleDriveBackup())
    expect(result.current.loading).toBe(false)
  })

  describe("startSession", () => {
    it("signs in and checks for existing file", async () => {
      mockFindAppDataFile.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useGoogleDriveBackup())

      let sessionResult:
        | Awaited<ReturnType<typeof result.current.startSession>>
        | undefined
      await act(async () => {
        sessionResult = await result.current.startSession("backup.json")
      })

      expect(mockConfigure).toHaveBeenCalled()
      expect(mockSignIn).toHaveBeenCalled()
      expect(sessionResult).toEqual({
        success: true,
        session: { accessToken: "test-access-token", existingFileId: undefined },
      })
    })

    it("returns existing file id when backup exists", async () => {
      mockFindAppDataFile.mockResolvedValueOnce("existing-id")

      const { result } = renderHook(() => useGoogleDriveBackup())

      let sessionResult:
        | Awaited<ReturnType<typeof result.current.startSession>>
        | undefined
      await act(async () => {
        sessionResult = await result.current.startSession("backup.json")
      })

      expect(sessionResult).toMatchObject({
        success: true,
        session: { existingFileId: "existing-id" },
      })
    })

    it("returns failure result on sign-in failure", async () => {
      mockSignIn.mockRejectedValueOnce(new Error("Sign in cancelled"))

      const { result } = renderHook(() => useGoogleDriveBackup())

      let sessionResult:
        | Awaited<ReturnType<typeof result.current.startSession>>
        | undefined
      await act(async () => {
        sessionResult = await result.current.startSession("backup.json")
      })

      expect(sessionResult).toEqual({
        success: false,
        reason: DriveErrorReason.Unknown,
      })
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it("checks play services before signing in on android", async () => {
      const originalOS = Platform.OS
      Object.defineProperty(Platform, "OS", { value: "android", configurable: true })
      mockFindAppDataFile.mockResolvedValueOnce(undefined)

      try {
        const { result } = renderHook(() => useGoogleDriveBackup())
        await act(async () => {
          await result.current.startSession("backup.json")
        })
      } finally {
        Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true })
      }

      expect(mockHasPlayServices).toHaveBeenCalled()
    })

    /** Signing out first only clears a stale session; there may be none to clear. */
    it("signs in anyway when the preceding sign-out fails", async () => {
      mockSignOut.mockRejectedValueOnce(new Error("no session to clear"))
      mockFindAppDataFile.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useGoogleDriveBackup())
      let sessionResult:
        | Awaited<ReturnType<typeof result.current.startSession>>
        | undefined
      await act(async () => {
        sessionResult = await result.current.startSession("backup.json")
      })

      expect(sessionResult).toMatchObject({ success: true })
    })
  })

  /** Google's granular consent lets the user finish sign-in with the Drive scope
   *  unchecked, which used to surface as a generic "sign in failed". */
  describe("drive scope consent", () => {
    const startSession = async () => {
      const { result } = renderHook(() => useGoogleDriveBackup())
      let sessionResult:
        | Awaited<ReturnType<typeof result.current.startSession>>
        | undefined
      await act(async () => {
        sessionResult = await result.current.startSession("backup.json")
      })
      return sessionResult
    }

    it("does not re-prompt when the scope was granted", async () => {
      mockFindAppDataFile.mockResolvedValueOnce(undefined)

      const sessionResult = await startSession()

      expect(mockAddScopes).not.toHaveBeenCalled()
      expect(sessionResult).toMatchObject({ success: true })
    })

    it("re-prompts for the scope when it was declined, and continues once granted", async () => {
      mockSignIn.mockResolvedValueOnce(signInSuccess(["openid", "email"]))
      mockAddScopes.mockResolvedValueOnce(signInSuccess())
      mockFindAppDataFile.mockResolvedValueOnce(undefined)

      const sessionResult = await startSession()

      expect(mockAddScopes).toHaveBeenCalledWith({ scopes: [DRIVE_SCOPE] })
      expect(sessionResult).toMatchObject({ success: true })
    })

    it("fails with permission-denied when the scope is declined twice", async () => {
      mockSignIn.mockResolvedValueOnce(signInSuccess(["openid", "email"]))
      mockAddScopes.mockResolvedValueOnce(signInSuccess(["openid", "email"]))

      const sessionResult = await startSession()

      expect(sessionResult).toEqual({
        success: false,
        reason: DriveErrorReason.PermissionDenied,
      })
    })

    it("fails with permission-denied when the re-prompt is dismissed", async () => {
      mockSignIn.mockResolvedValueOnce(signInSuccess(["openid", "email"]))
      mockAddScopes.mockResolvedValueOnce(null)

      const sessionResult = await startSession()

      expect(sessionResult).toEqual({
        success: false,
        reason: DriveErrorReason.PermissionDenied,
      })
    })

    it("fails with permission-denied when the re-prompt is cancelled", async () => {
      mockSignIn.mockResolvedValueOnce(signInSuccess(["openid", "email"]))
      mockAddScopes.mockResolvedValueOnce({ type: "cancelled", data: null })

      const sessionResult = await startSession()

      expect(sessionResult).toEqual({
        success: false,
        reason: DriveErrorReason.PermissionDenied,
      })
    })

    /** A declined scope is the user's choice, so it must not reach the crash reports. */
    it("does not report a declined scope to crashlytics", async () => {
      mockSignIn.mockResolvedValueOnce(signInSuccess(["openid", "email"]))
      mockAddScopes.mockResolvedValueOnce(null)

      await startSession()

      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it("treats a re-prompt that does not confirm the scope as a refusal", async () => {
      mockSignIn.mockResolvedValueOnce(signInSuccess(["openid", "email"]))
      mockAddScopes.mockResolvedValueOnce({ type: "success", data: {} })

      const sessionResult = await startSession()

      expect(sessionResult).toEqual({
        success: false,
        reason: DriveErrorReason.PermissionDenied,
      })
    })

    /** The proactive check cannot see a scope list the SDK never sent, so Drive answers
     *  403 instead; it must still reach the user as a permission problem, not a crash. */
    it("maps a scope-insufficient 403 from Drive to permission-denied", async () => {
      mockFindAppDataFile.mockRejectedValueOnce(
        new DriveError(
          DriveErrorReason.PermissionDenied,
          'Drive query failed (403): {"reason":"ACCESS_TOKEN_SCOPE_INSUFFICIENT"}',
        ),
      )

      const sessionResult = await startSession()

      expect(sessionResult).toEqual({
        success: false,
        reason: DriveErrorReason.PermissionDenied,
      })
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    /** Defensive: an unexpected response shape must not trap the user in a re-prompt loop. */
    it("skips the check when the response carries no scope list", async () => {
      mockSignIn.mockResolvedValueOnce({ type: "cancelled", data: null })
      mockFindAppDataFile.mockResolvedValueOnce(undefined)

      const sessionResult = await startSession()

      expect(mockAddScopes).not.toHaveBeenCalled()
      expect(sessionResult).toMatchObject({ success: true })
    })
  })

  describe("upload", () => {
    const mockSession = { accessToken: "test-token", existingFileId: undefined }

    it("creates new file with POST", async () => {
      mockUploadAppDataFile.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useGoogleDriveBackup())

      let uploadResult = { success: false } as { success: boolean }
      await act(async () => {
        uploadResult = await result.current.upload(
          '{"test": true}',
          "backup.json",
          mockSession,
        )
      })

      expect(uploadResult.success).toBe(true)
      expect(mockUploadAppDataFile).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '{"test": true}',
          fileName: "backup.json",
          accessToken: "test-token",
          existingId: undefined,
        }),
      )
    })

    it("updates existing file with PATCH", async () => {
      mockUploadAppDataFile.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useGoogleDriveBackup())

      const sessionWithFile = { accessToken: "test-token", existingFileId: "file-123" }

      await act(async () => {
        await result.current.upload('{"test": true}', "backup.json", sessionWithFile)
      })

      expect(mockUploadAppDataFile).toHaveBeenCalledWith(
        expect.objectContaining({
          existingId: "file-123",
        }),
      )
    })

    it("returns auth reason on upload 403", async () => {
      mockUploadAppDataFile.mockRejectedValueOnce(
        new DriveError(DriveErrorReason.Auth, "Drive upload failed (403): Forbidden"),
      )

      const { result } = renderHook(() => useGoogleDriveBackup())

      let uploadResult: Awaited<ReturnType<typeof result.current.upload>> | undefined
      await act(async () => {
        uploadResult = await result.current.upload(
          '{"test": true}',
          "backup.json",
          mockSession,
        )
      })

      expect(uploadResult).toEqual({ success: false, reason: DriveErrorReason.Auth })
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it("returns unknown reason when the thrown error is not a DriveError", async () => {
      mockUploadAppDataFile.mockRejectedValueOnce(new Error("plain JS error"))

      const { result } = renderHook(() => useGoogleDriveBackup())

      let uploadResult: Awaited<ReturnType<typeof result.current.upload>> | undefined
      await act(async () => {
        uploadResult = await result.current.upload(
          '{"test": true}',
          "backup.json",
          mockSession,
        )
      })

      expect(uploadResult).toEqual({
        success: false,
        reason: DriveErrorReason.Unknown,
      })
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it("reports a DriveError to crashlytics as-is, preserving the original instance", async () => {
      const original = new DriveError(
        DriveErrorReason.Transient,
        "Drive upload failed (503): Service unavailable",
      )
      mockUploadAppDataFile.mockRejectedValueOnce(original)

      const { result } = renderHook(() => useGoogleDriveBackup())

      await act(async () => {
        await result.current.upload('{"test": true}', "backup.json", mockSession)
      })

      expect(mockRecordError).toHaveBeenCalledWith(original)
    })

    it("wraps a generic Error with the upload operation context when reporting", async () => {
      mockUploadAppDataFile.mockRejectedValueOnce(new Error("plain JS error"))

      const { result } = renderHook(() => useGoogleDriveBackup())

      await act(async () => {
        await result.current.upload('{"test": true}', "backup.json", mockSession)
      })

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Drive upload failed: plain JS error",
        }),
      )
    })

    it("wraps a non-Error rejection with the upload operation context when reporting", async () => {
      mockUploadAppDataFile.mockRejectedValueOnce("string rejection")

      const { result } = renderHook(() => useGoogleDriveBackup())

      await act(async () => {
        await result.current.upload('{"test": true}', "backup.json", mockSession)
      })

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Drive upload failed: string rejection",
        }),
      )
    })
  })

  describe("listBackups", () => {
    it("signs in and returns entries with the access token", async () => {
      const entries = [
        { id: "file-1", name: "blink-spark-backup-blink-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-blink-pubkey2.json" },
      ]
      mockListAppDataFiles.mockResolvedValueOnce(entries)

      const { result } = renderHook(() => useGoogleDriveBackup())

      let listResult: Awaited<ReturnType<typeof result.current.listBackups>> | undefined
      await act(async () => {
        listResult = await result.current.listBackups("blink-spark-backup-blink-")
      })

      expect(mockSignIn).toHaveBeenCalled()
      expect(mockListAppDataFiles).toHaveBeenCalledWith(
        "blink-spark-backup-blink-",
        "test-access-token",
      )
      expect(listResult).toEqual({
        success: true,
        entries,
        accessToken: "test-access-token",
      })
    })

    it("returns empty entries when none match", async () => {
      mockListAppDataFiles.mockResolvedValueOnce([])

      const { result } = renderHook(() => useGoogleDriveBackup())

      let listResult: Awaited<ReturnType<typeof result.current.listBackups>> | undefined
      await act(async () => {
        listResult = await result.current.listBackups("prefix-")
      })

      expect(listResult).toMatchObject({ success: true, entries: [] })
    })

    it("returns failure result on sign-in failure", async () => {
      mockSignIn.mockRejectedValueOnce(new Error("Sign in cancelled"))

      const { result } = renderHook(() => useGoogleDriveBackup())

      let listResult: Awaited<ReturnType<typeof result.current.listBackups>> | undefined
      await act(async () => {
        listResult = await result.current.listBackups("prefix-")
      })

      expect(listResult).toEqual({
        success: false,
        reason: DriveErrorReason.Unknown,
      })
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
  })

  describe("downloadById", () => {
    it("returns content on success", async () => {
      mockDownloadAppDataFile.mockResolvedValueOnce('{"mnemonic":"words"}')

      const { result } = renderHook(() => useGoogleDriveBackup())

      let downloadResult:
        | Awaited<ReturnType<typeof result.current.downloadById>>
        | undefined
      await act(async () => {
        downloadResult = await result.current.downloadById("file-1", "token-abc")
      })

      expect(mockDownloadAppDataFile).toHaveBeenCalledWith("file-1", "token-abc")
      expect(downloadResult).toEqual({
        success: true,
        content: '{"mnemonic":"words"}',
      })
    })

    it("returns not-found reason on 404", async () => {
      mockDownloadAppDataFile.mockRejectedValueOnce(
        new DriveError(DriveErrorReason.NotFound, "Drive download failed (404)"),
      )

      const { result } = renderHook(() => useGoogleDriveBackup())

      let downloadResult:
        | Awaited<ReturnType<typeof result.current.downloadById>>
        | undefined
      await act(async () => {
        downloadResult = await result.current.downloadById("file-1", "token-abc")
      })

      expect(downloadResult).toEqual({
        success: false,
        reason: DriveErrorReason.NotFound,
      })
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it("returns auth reason on 401", async () => {
      mockDownloadAppDataFile.mockRejectedValueOnce(
        new DriveError(DriveErrorReason.Auth, "Drive download failed (401)"),
      )

      const { result } = renderHook(() => useGoogleDriveBackup())

      let downloadResult:
        | Awaited<ReturnType<typeof result.current.downloadById>>
        | undefined
      await act(async () => {
        downloadResult = await result.current.downloadById("file-1", "token-abc")
      })

      expect(downloadResult).toEqual({
        success: false,
        reason: DriveErrorReason.Auth,
      })
    })

    it("returns transient reason on network failure", async () => {
      mockDownloadAppDataFile.mockRejectedValueOnce(
        new DriveError(DriveErrorReason.Transient, "Drive network error: offline"),
      )

      const { result } = renderHook(() => useGoogleDriveBackup())

      let downloadResult:
        | Awaited<ReturnType<typeof result.current.downloadById>>
        | undefined
      await act(async () => {
        downloadResult = await result.current.downloadById("file-1", "token-abc")
      })

      expect(downloadResult).toEqual({
        success: false,
        reason: DriveErrorReason.Transient,
      })
    })

    it("wraps a generic Error with the download operation context when reporting", async () => {
      mockDownloadAppDataFile.mockRejectedValueOnce(new Error("plain JS error"))

      const { result } = renderHook(() => useGoogleDriveBackup())

      await act(async () => {
        await result.current.downloadById("file-1", "token-abc")
      })

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Drive download failed: plain JS error",
        }),
      )
    })
  })

  describe("resolveErrorMessage", () => {
    const resolve = (reason: CloudBackupErrorReason) => {
      const { result } = renderHook(() => useGoogleDriveBackup())
      return result.current.resolveErrorMessage(reason, LL)
    }

    it("tells the user to grant storage access when the scope was declined", () => {
      const message = resolve(DriveErrorReason.PermissionDenied)

      expect(message).toContain("Google Drive")
      expect(message).not.toBe(
        LL.BackupScreen.CloudBackup.signInFailed({
          provider: LL.BackupScreen.BackupMethod.googleDrive(),
        }),
      )
    })

    it("keeps the network message for a transient failure", () => {
      expect(resolve(DriveErrorReason.Transient)).toBe(
        LL.BackupScreen.CloudBackup.networkError(),
      )
    })

    it("falls back to the generic sign-in message for other reasons", () => {
      expect(resolve(DriveErrorReason.Unknown)).toBe(
        LL.BackupScreen.CloudBackup.signInFailed({
          provider: LL.BackupScreen.BackupMethod.googleDrive(),
        }),
      )
    })
  })
})
