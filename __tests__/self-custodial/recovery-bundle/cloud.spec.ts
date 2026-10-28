let mockPlatformOS: "ios" | "android" = "ios"

const mockGetCurrentUser = jest.fn()
const mockSignInSilently = jest.fn()
const mockGetTokens = jest.fn()
const mockConfigure = jest.fn()
const mockClearCachedAccessToken = jest.fn()
const mockDriveFindAppDataFile = jest.fn()
const mockDriveUploadAppDataFile = jest.fn()
const mockDriveDeleteAppDataFile = jest.fn()
const mockDriveListAppDataFiles = jest.fn()
const mockAssertICloudAvailable = jest.fn()
const mockICloudUploadAppDataFile = jest.fn()
const mockICloudDeleteAppDataFile = jest.fn()

jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatformOS
    },
  },
}))

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
    signInSilently: (...args: unknown[]) => mockSignInSilently(...args),
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
    clearCachedAccessToken: (...args: unknown[]) => mockClearCachedAccessToken(...args),
  },
}))

// The real DriveError stays: the dead-token retry decides on `instanceof
// DriveError && status === 401`, which a stub class would never satisfy.
jest.mock("@app/utils/google-drive-client", () => ({
  DriveError: jest.requireActual("@app/utils/google-drive-client").DriveError,
  findAppDataFile: (...args: unknown[]) => mockDriveFindAppDataFile(...args),
  uploadAppDataFile: (...args: unknown[]) => mockDriveUploadAppDataFile(...args),
  deleteAppDataFile: (...args: unknown[]) => mockDriveDeleteAppDataFile(...args),
  listAppDataFiles: (...args: unknown[]) => mockDriveListAppDataFiles(...args),
}))

jest.mock("@app/utils/icloud-client", () => ({
  assertICloudAvailable: (...args: unknown[]) => mockAssertICloudAvailable(...args),
  uploadAppDataFile: (...args: unknown[]) => mockICloudUploadAppDataFile(...args),
  deleteAppDataFile: (...args: unknown[]) => mockICloudDeleteAppDataFile(...args),
}))

import {
  attemptSilentCloudDelete,
  attemptSilentCloudUpload,
  getRecoveryBundleFilename,
  getRecoveryBundleFilenamePrefix,
} from "@app/self-custodial/recovery-bundle/cloud"
import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import { DriveError } from "@app/utils/google-drive-client"

const CONTENT = '{"encrypted":true}'
const FILE_NAME = "blink-spark-recovery-bundle-mainnet-02ab.json"

describe("recovery bundle filenames", () => {
  it("builds a lowercase, network-scoped filename around the wallet identifier", () => {
    expect(getRecoveryBundleFilenamePrefix("MAINNET")).toBe(
      "blink-spark-recovery-bundle-mainnet-",
    )
    expect(getRecoveryBundleFilename("MAINNET", "02ab")).toBe(FILE_NAME)
  })
})

describe("attemptSilentCloudUpload on iOS", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPlatformOS = "ios"
    mockAssertICloudAvailable.mockResolvedValue(undefined)
    mockICloudUploadAppDataFile.mockResolvedValue(undefined)
  })

  it("uploads to iCloud without any interactive session", async () => {
    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockICloudUploadAppDataFile).toHaveBeenCalledWith({
      content: CONTENT,
      fileName: FILE_NAME,
    })
    expect(mockConfigure).not.toHaveBeenCalled()
  })

  it("maps a reason-carrying error and preserves the original", async () => {
    const err = Object.assign(new Error("iCloud unavailable"), { reason: "auth" })
    mockAssertICloudAvailable.mockRejectedValue(err)

    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: false, reason: "auth", error: err })
    expect(mockICloudUploadAppDataFile).not.toHaveBeenCalled()
  })

  it("maps an error without a reason to unknown, carrying the original", async () => {
    const err = new Error("NSFileManager write failed")
    mockICloudUploadAppDataFile.mockRejectedValue(err)

    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: false, reason: "unknown", error: err })
  })
})

describe("attemptSilentCloudUpload on Android", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPlatformOS = "android"
    mockGetCurrentUser.mockReturnValue({ user: { email: "u@example.com" } })
    mockGetTokens.mockResolvedValue({ accessToken: "token-1" })
    mockDriveFindAppDataFile.mockResolvedValue(undefined)
    mockDriveUploadAppDataFile.mockResolvedValue(undefined)
  })

  it("uploads with the current session's token, replacing an existing file", async () => {
    mockDriveFindAppDataFile.mockResolvedValue("existing-file-id")

    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockSignInSilently).not.toHaveBeenCalled()
    expect(mockDriveFindAppDataFile).toHaveBeenCalledWith(FILE_NAME, "token-1")
    expect(mockDriveUploadAppDataFile).toHaveBeenCalledWith({
      content: CONTENT,
      fileName: FILE_NAME,
      accessToken: "token-1",
      existingId: "existing-file-id",
    })
  })

  it("tries a silent sign-in when no user session exists", async () => {
    mockGetCurrentUser.mockReturnValue(null)
    mockSignInSilently.mockResolvedValue({ type: "success" })

    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockSignInSilently).toHaveBeenCalledTimes(1)
    expect(mockDriveUploadAppDataFile).toHaveBeenCalledTimes(1)
  })

  it("reports an auth failure without popping UI when the silent sign-in fails", async () => {
    // The event-driven refresh path must never prompt; a user who never
    // linked Drive is an expected auth miss, not an error.
    mockGetCurrentUser.mockReturnValue(null)
    mockSignInSilently.mockResolvedValue({ type: "noSavedCredentialFound" })

    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: false, reason: "auth" })
    expect(mockGetTokens).not.toHaveBeenCalled()
    expect(mockDriveUploadAppDataFile).not.toHaveBeenCalled()
  })

  it("maps a Drive upload failure to its reason, carrying the original error", async () => {
    const err = Object.assign(new Error("quota exceeded"), { reason: "transient" })
    mockDriveUploadAppDataFile.mockRejectedValue(err)

    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: false, reason: "transient", error: err })
  })

  it("clears a dead cached token on a 401 and retries once with a fresh one", async () => {
    // A token revoked out-of-band stays in the sign-in cache; without the
    // clear-and-retry, every silent sync would fail with it forever.
    mockGetTokens
      .mockResolvedValueOnce({ accessToken: "dead-token" })
      .mockResolvedValueOnce({ accessToken: "fresh-token" })
    mockDriveFindAppDataFile
      .mockRejectedValueOnce(
        new DriveError(CloudBackupErrorReason.Auth, "Drive query failed (401)", 401),
      )
      .mockResolvedValueOnce("existing-file-id")

    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockClearCachedAccessToken).toHaveBeenCalledWith("dead-token")
    expect(mockDriveFindAppDataFile).toHaveBeenLastCalledWith(FILE_NAME, "fresh-token")
    expect(mockDriveUploadAppDataFile).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "fresh-token",
        existingId: "existing-file-id",
      }),
    )
  })

  it("does not retry a 403: a new token cannot fix a withheld permission", async () => {
    const forbidden = new DriveError(
      CloudBackupErrorReason.Auth,
      "Drive query failed (403)",
      403,
    )
    mockDriveFindAppDataFile.mockRejectedValue(forbidden)

    const result = await attemptSilentCloudUpload(CONTENT, FILE_NAME)

    expect(result).toEqual({ success: false, reason: "auth", error: forbidden })
    expect(mockClearCachedAccessToken).not.toHaveBeenCalled()
    expect(mockDriveFindAppDataFile).toHaveBeenCalledTimes(1)
  })
})

describe("attemptSilentCloudDelete on iOS", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPlatformOS = "ios"
    mockAssertICloudAvailable.mockResolvedValue(undefined)
    mockICloudDeleteAppDataFile.mockResolvedValue(undefined)
  })

  it("deletes the file without any interactive session", async () => {
    // The client removes the item downloaded or not, and counts a missing one
    // as removed, so no lookup comes first: a lookup misses an undownloaded item.
    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockICloudDeleteAppDataFile).toHaveBeenCalledWith(FILE_NAME)
    expect(mockConfigure).not.toHaveBeenCalled()
  })

  it("maps an unavailable iCloud to its reason without deleting", async () => {
    const err = Object.assign(new Error("iCloud unavailable"), { reason: "auth" })
    mockAssertICloudAvailable.mockRejectedValue(err)

    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: false, reason: "auth", error: err })
    expect(mockICloudDeleteAppDataFile).not.toHaveBeenCalled()
  })

  it("maps a failed delete to its reason, carrying the original", async () => {
    const err = Object.assign(new Error("iCloud delete failed"), { reason: "transient" })
    mockICloudDeleteAppDataFile.mockRejectedValue(err)

    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: false, reason: "transient", error: err })
  })
})

describe("attemptSilentCloudDelete on Android", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPlatformOS = "android"
    mockGetCurrentUser.mockReturnValue({ user: { email: "u@example.com" } })
    mockGetTokens.mockResolvedValue({ accessToken: "token-1" })
    mockDriveListAppDataFiles.mockResolvedValue([{ id: "file-1", name: FILE_NAME }])
    mockDriveDeleteAppDataFile.mockResolvedValue(undefined)
  })

  it("deletes the file it finds with the session's token", async () => {
    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockDriveListAppDataFiles).toHaveBeenCalledWith(FILE_NAME, "token-1")
    expect(mockDriveDeleteAppDataFile).toHaveBeenCalledWith("file-1", "token-1")
  })

  it("deletes every file with exactly that name, and none with a longer one", async () => {
    // Drive allows duplicate names: two devices syncing the same wallet for
    // the first time can each create a copy.
    mockDriveListAppDataFiles.mockResolvedValue([
      { id: "file-1", name: FILE_NAME },
      { id: "file-2", name: FILE_NAME },
      { id: "file-3", name: `${FILE_NAME}.old` },
    ])

    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockDriveDeleteAppDataFile.mock.calls).toEqual([
      ["file-1", "token-1"],
      ["file-2", "token-1"],
    ])
  })

  it("counts a file that is not there as removed", async () => {
    mockDriveListAppDataFiles.mockResolvedValue([])

    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockDriveDeleteAppDataFile).not.toHaveBeenCalled()
  })

  it("counts a file another device removed first as removed, and goes on", async () => {
    mockDriveListAppDataFiles.mockResolvedValue([
      { id: "file-1", name: FILE_NAME },
      { id: "file-2", name: FILE_NAME },
    ])
    mockDriveDeleteAppDataFile.mockRejectedValueOnce(
      new DriveError(CloudBackupErrorReason.NotFound, "Drive delete failed (404)", 404),
    )

    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: true })
    expect(mockDriveDeleteAppDataFile).toHaveBeenLastCalledWith("file-2", "token-1")
  })

  it("reports an auth failure without popping UI when no session can be restored", async () => {
    mockGetCurrentUser.mockReturnValue(null)
    mockSignInSilently.mockResolvedValue({ type: "noSavedCredentialFound" })

    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: false, reason: "auth" })
    expect(mockDriveListAppDataFiles).not.toHaveBeenCalled()
  })

  it("maps a failed delete to its reason, carrying the original", async () => {
    const err = new DriveError(
      CloudBackupErrorReason.Transient,
      "Drive delete failed (503)",
    )
    mockDriveDeleteAppDataFile.mockRejectedValue(err)

    const result = await attemptSilentCloudDelete(FILE_NAME)

    expect(result).toEqual({ success: false, reason: "transient", error: err })
  })
})
