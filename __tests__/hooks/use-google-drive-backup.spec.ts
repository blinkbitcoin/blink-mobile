import { renderHook, act } from "@testing-library/react-native"

import { useGoogleDriveBackup } from "@app/hooks/use-google-drive-backup"

const mockConfigure = jest.fn()
const mockHasPlayServices = jest.fn(() => Promise.resolve(true))
const mockSignIn = jest.fn(() => Promise.resolve({ idToken: "token" }))
const mockGetTokens = jest.fn(() =>
  Promise.resolve({ accessToken: "test-access-token", idToken: "token" }),
)

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: (...args: readonly unknown[]) => mockConfigure(...args),
    hasPlayServices: () => mockHasPlayServices(),
    signIn: () => mockSignIn(),
    getTokens: () => mockGetTokens(),
  },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

describe("useGoogleDriveBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  it("returns initial state", () => {
    const { result } = renderHook(() => useGoogleDriveBackup())
    expect(result.current.loading).toBe(false)
  })

  describe("startSession", () => {
    it("signs in and checks for existing file", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      })

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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [{ id: "existing-id" }] }),
      })

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
      mockFetch.mockResolvedValueOnce({ ok: true })

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
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("uploadType=multipart"),
        expect.objectContaining({ method: "POST" }),
      )
    })

    it("updates existing file with PATCH", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const { result } = renderHook(() => useGoogleDriveBackup())

      const sessionWithFile = { accessToken: "test-token", existingFileId: "file-123" }

      await act(async () => {
        await result.current.upload('{"test": true}', "backup.json", sessionWithFile)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("file-123"),
        expect.objectContaining({ method: "PATCH" }),
      )
    })

    it("returns error on upload failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      })

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
      expect(uploadResult.error).toBe("403: Forbidden")
    })
  })
})
