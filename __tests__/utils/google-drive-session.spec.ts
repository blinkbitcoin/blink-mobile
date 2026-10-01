const mockClearCachedAccessToken = jest.fn()
const mockGetTokens = jest.fn()

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    clearCachedAccessToken: (...args: unknown[]) => mockClearCachedAccessToken(...args),
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
  },
}))

import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import { DriveError } from "@app/utils/google-drive-client"
import { callDrive, isDeadAccessToken } from "@app/utils/google-drive-session"

const deadToken = () =>
  new DriveError(CloudBackupErrorReason.Auth, "Drive query failed (401)", 401)

describe("isDeadAccessToken", () => {
  it("is true only for a DriveError carrying a 401 status", () => {
    expect(isDeadAccessToken(deadToken())).toBe(true)
    // 403 shares the auth reason but means a withheld permission - a new
    // token cannot fix it, so it must not count as a dead token.
    expect(
      isDeadAccessToken(
        new DriveError(CloudBackupErrorReason.Auth, "Drive query failed (403)", 403),
      ),
    ).toBe(false)
    expect(
      isDeadAccessToken(new DriveError(CloudBackupErrorReason.Transient, "network")),
    ).toBe(false)
    expect(isDeadAccessToken(new Error("Drive query failed (401)"))).toBe(false)
  })
})

describe("callDrive", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockClearCachedAccessToken.mockResolvedValue(undefined)
    mockGetTokens.mockResolvedValue({ accessToken: "fresh-token" })
  })

  it("passes the token through and returns the call's value on success", async () => {
    const call = jest.fn().mockResolvedValue("file-id")

    const result = await callDrive("token-1", call)

    expect(result).toEqual({ value: "file-id", token: "token-1" })
    expect(call).toHaveBeenCalledWith("token-1")
    expect(mockClearCachedAccessToken).not.toHaveBeenCalled()
  })

  it("clears a dead cached token on a 401 and retries once with the refreshed one", async () => {
    const call = jest.fn().mockRejectedValueOnce(deadToken()).mockResolvedValue("file-id")

    const result = await callDrive("dead-token", call)

    // The refreshed token is returned so the caller holds it for the rest of
    // the session instead of replaying the dead one on the next call.
    expect(result).toEqual({ value: "file-id", token: "fresh-token" })
    expect(mockClearCachedAccessToken).toHaveBeenCalledWith("dead-token")
    expect(call).toHaveBeenNthCalledWith(2, "fresh-token")
  })

  it("retries only once: a 401 with the refreshed token propagates", async () => {
    const secondFailure = deadToken()
    const call = jest
      .fn()
      .mockRejectedValueOnce(deadToken())
      .mockRejectedValueOnce(secondFailure)

    await expect(callDrive("dead-token", call)).rejects.toBe(secondFailure)
    expect(call).toHaveBeenCalledTimes(2)
    expect(mockClearCachedAccessToken).toHaveBeenCalledTimes(1)
  })

  it("rethrows a non-401 DriveError untouched without clearing the cache", async () => {
    const forbidden = new DriveError(
      CloudBackupErrorReason.Auth,
      "Drive query failed (403)",
      403,
    )
    const call = jest.fn().mockRejectedValue(forbidden)

    await expect(callDrive("token-1", call)).rejects.toBe(forbidden)
    expect(mockClearCachedAccessToken).not.toHaveBeenCalled()
    expect(call).toHaveBeenCalledTimes(1)
  })

  it("rethrows a non-Drive error untouched", async () => {
    const unrelated = new Error("boom")
    const call = jest.fn().mockRejectedValue(unrelated)

    await expect(callDrive("token-1", call)).rejects.toBe(unrelated)
    expect(mockClearCachedAccessToken).not.toHaveBeenCalled()
  })

  it("keeps the original 401 when the token refresh itself fails", async () => {
    // The 401 is the diagnosis; a failed refresh only says the retry never ran.
    const original = deadToken()
    const call = jest.fn().mockRejectedValue(original)
    mockGetTokens.mockRejectedValue(new Error("refresh failed"))

    await expect(callDrive("dead-token", call)).rejects.toBe(original)
    expect(call).toHaveBeenCalledTimes(1)
  })
})
