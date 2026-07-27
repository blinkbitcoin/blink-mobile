let mockPlatformOS: "ios" | "android" = "ios"

const mockGetCurrentUser = jest.fn()
const mockSignInSilently = jest.fn()
const mockGetTokens = jest.fn()
const mockConfigure = jest.fn()
const mockDriveFindAppDataFile = jest.fn()
const mockDriveUploadAppDataFile = jest.fn()
const mockAssertICloudAvailable = jest.fn()
const mockICloudUploadAppDataFile = jest.fn()

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
  },
}))

jest.mock("@app/utils/google-drive-client", () => ({
  findAppDataFile: (...args: unknown[]) => mockDriveFindAppDataFile(...args),
  uploadAppDataFile: (...args: unknown[]) => mockDriveUploadAppDataFile(...args),
}))

jest.mock("@app/utils/icloud-client", () => ({
  assertICloudAvailable: (...args: unknown[]) => mockAssertICloudAvailable(...args),
  uploadAppDataFile: (...args: unknown[]) => mockICloudUploadAppDataFile(...args),
}))

import {
  attemptSilentCloudUpload,
  getRecoveryBundleFilename,
  getRecoveryBundleFilenamePrefix,
} from "@app/self-custodial/recovery-bundle/cloud"

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
})
