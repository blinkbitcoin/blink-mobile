import { renderHook, act } from "@testing-library/react-native"

import { useGoogleDriveBackup } from "@app/hooks/use-google-drive-backup"

const mockConfigure = jest.fn()
const mockHasPlayServices = jest.fn(() => Promise.resolve(true))
const mockSignOut = jest.fn(() => Promise.resolve())
const mockSignIn = jest.fn(() => Promise.resolve({ idToken: "token" }))
const mockGetTokens = jest.fn(() =>
  Promise.resolve({ accessToken: "test-access-token", idToken: "token" }),
)

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: (...args: readonly unknown[]) => mockConfigure(...args),
    hasPlayServices: () => mockHasPlayServices(),
    signOut: () => mockSignOut(),
    signIn: () => mockSignIn(),
    getTokens: () => mockGetTokens(),
  },
}))

const mockFindAppDataFile = jest.fn()
const mockUploadAppDataFile = jest.fn()
const mockDownloadAppDataFile = jest.fn()
const mockListAppDataFiles = jest.fn()

jest.mock("@app/utils/google-drive-client", () => ({
  findAppDataFile: (...args: readonly unknown[]) => mockFindAppDataFile(...args),
  uploadAppDataFile: (...args: readonly unknown[]) => mockUploadAppDataFile(...args),
  downloadAppDataFile: (...args: readonly unknown[]) => mockDownloadAppDataFile(...args),
  listAppDataFiles: (...args: readonly unknown[]) => mockListAppDataFiles(...args),
}))

describe("useGoogleDriveBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns initial state", () => {
    const { result } = renderHook(() => useGoogleDriveBackup())
    expect(result.current.loading).toBe(false)
  })

  describe("startSession", () => {
    it("signs in and checks for existing file", async () => {
      mockFindAppDataFile.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useGoogleDriveBackup())

      let session = { accessToken: "", existingFileId: undefined as string | undefined }
      await act(async () => {
        session = await result.current.startSession("backup.json")
      })

      expect(mockConfigure).toHaveBeenCalled()
      expect(mockSignIn).toHaveBeenCalled()
      expect(session.accessToken).toBe("test-access-token")
      expect(session.existingFileId).toBeUndefined()
    })

    it("returns existing file id when backup exists", async () => {
      mockFindAppDataFile.mockResolvedValueOnce("existing-id")

      const { result } = renderHook(() => useGoogleDriveBackup())

      let session = { accessToken: "", existingFileId: undefined as string | undefined }
      await act(async () => {
        session = await result.current.startSession("backup.json")
      })

      expect(session.existingFileId).toBe("existing-id")
    })

    it("throws on sign-in failure", async () => {
      mockSignIn.mockRejectedValueOnce(new Error("Sign in cancelled"))

      const { result } = renderHook(() => useGoogleDriveBackup())

      await expect(
        act(async () => {
          await result.current.startSession("backup.json")
        }),
      ).rejects.toThrow("Sign in cancelled")
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

    it("returns error on upload failure", async () => {
      mockUploadAppDataFile.mockRejectedValueOnce(
        new Error("Drive upload failed (403): Forbidden"),
      )

      const { result } = renderHook(() => useGoogleDriveBackup())

      let uploadResult = { success: true } as { success: boolean; error?: string }
      await act(async () => {
        uploadResult = await result.current.upload(
          '{"test": true}',
          "backup.json",
          mockSession,
        )
      })

      expect(uploadResult.success).toBe(false)
      expect(uploadResult.error).toBe("Drive upload failed (403): Forbidden")
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

      expect(listResult?.entries).toEqual([])
    })

    it("propagates sign-in failure", async () => {
      mockSignIn.mockRejectedValueOnce(new Error("Sign in cancelled"))

      const { result } = renderHook(() => useGoogleDriveBackup())

      await expect(
        act(async () => {
          await result.current.listBackups("prefix-")
        }),
      ).rejects.toThrow("Sign in cancelled")
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

    it("returns error on failure", async () => {
      mockDownloadAppDataFile.mockRejectedValueOnce(
        new Error("Drive download failed (404)"),
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
        error: "Drive download failed (404)",
      })
    })
  })
})
