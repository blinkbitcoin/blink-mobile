let mockPlatformOS: "ios" | "android" = "ios"

const mockGetCurrentUser = jest.fn()
const mockSignInSilently = jest.fn()
const mockGetTokens = jest.fn()
const mockConfigure = jest.fn()
const mockClearCachedAccessToken = jest.fn()
const mockDriveFindAppDataFile = jest.fn()
const mockDriveUploadAppDataFile = jest.fn()
const mockAssertICloudAvailable = jest.fn()
const mockICloudUploadAppDataFile = jest.fn()
const mockDriveDownloadAppDataFile = jest.fn()
const mockICloudFindAppDataFile = jest.fn()
const mockICloudDownloadAppDataFile = jest.fn()

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
  downloadAppDataFile: (...args: unknown[]) => mockDriveDownloadAppDataFile(...args),
}))

jest.mock("@app/utils/icloud-client", () => ({
  assertICloudAvailable: (...args: unknown[]) => mockAssertICloudAvailable(...args),
  uploadAppDataFile: (...args: unknown[]) => mockICloudUploadAppDataFile(...args),
  findAppDataFile: (...args: unknown[]) => mockICloudFindAppDataFile(...args),
  downloadAppDataFile: (...args: unknown[]) => mockICloudDownloadAppDataFile(...args),
}))

import {
  attemptSilentCloudFetch,
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

describe("attemptSilentCloudFetch on iOS", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPlatformOS = "ios"
    mockAssertICloudAvailable.mockResolvedValue(undefined)
    mockICloudFindAppDataFile.mockResolvedValue(FILE_NAME)
    mockICloudDownloadAppDataFile.mockResolvedValue(CONTENT)
  })

  it("returns the bundle stored under the expected name", async () => {
    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: true,
      content: CONTENT,
    })
    expect(mockICloudFindAppDataFile).toHaveBeenCalledWith(FILE_NAME)
  })

  it("reports a miss rather than downloading nothing", async () => {
    mockICloudFindAppDataFile.mockResolvedValue(undefined)

    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: false,
      reason: CloudBackupErrorReason.NotFound,
    })
    expect(mockICloudDownloadAppDataFile).not.toHaveBeenCalled()
  })

  it("carries through the reason when iCloud is unavailable", async () => {
    mockAssertICloudAvailable.mockRejectedValue({
      reason: CloudBackupErrorReason.PermissionDenied,
    })

    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: false,
      reason: CloudBackupErrorReason.PermissionDenied,
    })
  })

  it("falls back to unknown for a failure carrying no reason", async () => {
    mockICloudDownloadAppDataFile.mockRejectedValue(new Error("offline"))

    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: false,
      reason: CloudBackupErrorReason.Unknown,
    })
  })
})

describe("attemptSilentCloudFetch on Android", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPlatformOS = "android"
    mockGetCurrentUser.mockReturnValue({ user: { id: "1" } })
    mockGetTokens.mockResolvedValue({ accessToken: "token" })
    mockDriveFindAppDataFile.mockResolvedValue("file-1")
    mockDriveDownloadAppDataFile.mockResolvedValue(CONTENT)
  })

  it("returns the bundle without prompting anyone to sign in", async () => {
    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: true,
      content: CONTENT,
    })
    // A sign-in sheet here would defeat the point of looking before asking.
    expect(mockSignInSilently).not.toHaveBeenCalled()
    expect(mockDriveDownloadAppDataFile).toHaveBeenCalledWith("file-1", "token")
  })

  it("signs in silently when no session is cached", async () => {
    mockGetCurrentUser.mockReturnValue(null)
    mockSignInSilently.mockResolvedValue({ type: "success" })

    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: true,
      content: CONTENT,
    })
  })

  it("reports an unlinked Drive as an auth miss", async () => {
    // Expected, not exceptional: most users reaching emergency recovery never
    // linked cloud backup at all.
    mockGetCurrentUser.mockReturnValue(null)
    mockSignInSilently.mockResolvedValue({ type: "noSavedCredentialFound" })

    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: false,
      reason: CloudBackupErrorReason.Auth,
    })
    expect(mockDriveFindAppDataFile).not.toHaveBeenCalled()
  })

  it("reports a missing file rather than downloading nothing", async () => {
    mockDriveFindAppDataFile.mockResolvedValue(undefined)

    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: false,
      reason: CloudBackupErrorReason.NotFound,
    })
    expect(mockDriveDownloadAppDataFile).not.toHaveBeenCalled()
  })

  it("retries once with a fresh token when the cached one is dead", async () => {
    mockDriveFindAppDataFile
      .mockRejectedValueOnce(
        new DriveError(CloudBackupErrorReason.Auth, "Drive query failed (401)", 401),
      )
      .mockResolvedValueOnce("file-1")
    mockGetTokens
      .mockResolvedValueOnce({ accessToken: "stale" })
      .mockResolvedValueOnce({ accessToken: "fresh" })

    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: true,
      content: CONTENT,
    })
    expect(mockClearCachedAccessToken).toHaveBeenCalled()
  })

  it("carries through the reason on a Drive failure", async () => {
    mockDriveDownloadAppDataFile.mockRejectedValue({
      reason: CloudBackupErrorReason.Transient,
    })

    await expect(attemptSilentCloudFetch(FILE_NAME)).resolves.toEqual({
      success: false,
      reason: CloudBackupErrorReason.Transient,
    })
  })
})
