import {
  buildMultipartBody,
  downloadAppDataFile,
  DriveError,
  DriveErrorReason,
  findAppDataFile,
  listAppDataFiles,
  uploadAppDataFile,
} from "@app/utils/google-drive-client"

describe("google drive client", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it("builds multipart body with the provided boundary", () => {
    const body = buildMultipartBody('{"name":"backup.json"}', "content", "test-boundary")

    expect(body).toContain("--test-boundary")
    expect(body).toContain("Content-Type: application/json; charset=UTF-8")
    expect(body).toContain("Content-Type: text/plain; charset=UTF-8")
    expect(body.endsWith("--test-boundary--")).toBe(true)
  })

  it("finds files in appDataFolder with trashed filter and escaped filename", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ files: [{ id: "file-123" }] }),
    })

    const fileId = await findAppDataFile("blink's backup.json", "token")

    expect(fileId).toBe("file-123")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent(
          "name='blink\\'s backup.json' and 'appDataFolder' in parents and trashed = false",
        ),
      ),
      expect.objectContaining({
        headers: { Authorization: "Bearer token" },
      }),
    )
  })

  it("throws DriveError with reason='auth' on 401 (Critical #8)", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    })

    await expect(findAppDataFile("backup.json", "token")).rejects.toMatchObject({
      name: "DriveError",
      reason: DriveErrorReason.Auth,
      message: expect.stringContaining("Drive query failed (401)"),
    })
  })

  it("throws DriveError with reason='auth' on 403 (Critical #8)", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    })

    await expect(findAppDataFile("backup.json", "token")).rejects.toMatchObject({
      reason: DriveErrorReason.Auth,
    })
  })

  it("throws DriveError with reason='transient' on 429 (Critical #8)", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    })

    await expect(findAppDataFile("backup.json", "token")).rejects.toMatchObject({
      reason: DriveErrorReason.Transient,
    })
  })

  it("throws DriveError with reason='transient' on 503 (Critical #8)", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service unavailable",
    })

    await expect(findAppDataFile("backup.json", "token")).rejects.toMatchObject({
      reason: DriveErrorReason.Transient,
    })
  })

  it("throws DriveError with reason='transient' on the 500 boundary (Critical #8)", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal server error",
    })

    await expect(findAppDataFile("backup.json", "token")).rejects.toMatchObject({
      reason: DriveErrorReason.Transient,
    })
  })

  it("throws DriveError with reason='transient' when fetch itself rejects (network failure) (Critical #8)", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(
      new TypeError("Network request failed"),
    )

    const error = await findAppDataFile("backup.json", "token").catch((e) => e)
    expect(error).toBeInstanceOf(DriveError)
    expect(error.reason).toBe(DriveErrorReason.Transient)
    expect(error.message).toContain("Drive network error")
  })

  it("uploads with POST when there is no existing file", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    await uploadAppDataFile({
      content: "content",
      fileName: "backup.json",
      accessToken: "token",
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("uploadType=multipart"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer token",
          "Content-Type": expect.stringContaining("multipart/related; boundary=blink_"),
        }),
        body: expect.stringContaining('"parents":["appDataFolder"]'),
      }),
    )
  })

  it("uploads with PATCH when updating an existing file", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    await uploadAppDataFile({
      content: "content",
      fileName: "backup.json",
      accessToken: "token",
      existingId: "file-123",
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/file-123?uploadType=multipart"),
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"name":"backup.json"'),
      }),
    )
  })

  it("downloadAppDataFile returns file content on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"mnemonic":"test words"}'),
    })

    const content = await downloadAppDataFile("file-456", "token-abc")

    expect(content).toBe('{"mnemonic":"test words"}')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/file-456?alt=media"),
      expect.objectContaining({
        headers: { Authorization: "Bearer token-abc" },
      }),
    )
  })

  describe("listAppDataFiles", () => {
    it("queries appDataFolder with name-contains and trashed filter", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ files: [] }),
      })

      await listAppDataFiles("blink-spark-backup-blink-", "token")

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          encodeURIComponent(
            "name contains 'blink-spark-backup-blink-' and 'appDataFolder' in parents and trashed = false",
          ),
        ),
        expect.objectContaining({
          headers: { Authorization: "Bearer token" },
        }),
      )
    })

    it("returns matching entries with id and name", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [
            { id: "file-1", name: "blink-spark-backup-blink-pubkey1.json" },
            { id: "file-2", name: "blink-spark-backup-blink-pubkey2.json" },
          ],
        }),
      })

      const entries = await listAppDataFiles("blink-spark-backup-blink-", "token")

      expect(entries).toEqual([
        { id: "file-1", name: "blink-spark-backup-blink-pubkey1.json" },
        { id: "file-2", name: "blink-spark-backup-blink-pubkey2.json" },
      ])
    })

    it("filters out entries that do not start with the prefix (substring matches)", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [
            { id: "file-1", name: "blink-spark-backup-blink-pubkey1.json" },
            { id: "file-2", name: "other-blink-spark-backup-blink-noise.json" },
          ],
        }),
      })

      const entries = await listAppDataFiles("blink-spark-backup-blink-", "token")

      expect(entries).toEqual([
        { id: "file-1", name: "blink-spark-backup-blink-pubkey1.json" },
      ])
    })

    it("escapes single quotes in the prefix", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ files: [] }),
      })

      await listAppDataFiles("blink's-backup-", "token")

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("name contains 'blink\\'s-backup-'")),
        expect.any(Object),
      )
    })

    it("throws DriveError with reason='auth' when list returns 401 (Critical #8)", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      })

      await expect(listAppDataFiles("prefix-", "token")).rejects.toMatchObject({
        reason: DriveErrorReason.Auth,
        message: expect.stringContaining("Drive list query failed (401)"),
      })
    })
  })

  it("downloadAppDataFile throws DriveError with reason='not-found' on 404 (Critical #8)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    })

    await expect(downloadAppDataFile("file-456", "token-abc")).rejects.toMatchObject({
      reason: DriveErrorReason.NotFound,
      message: expect.stringContaining("Drive download failed (404)"),
    })
  })

  it("downloadAppDataFile throws DriveError with reason='unknown' on 418 (Critical #8)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 418,
      text: () => Promise.resolve("I'm a teapot"),
    })

    await expect(downloadAppDataFile("file-456", "token-abc")).rejects.toMatchObject({
      reason: DriveErrorReason.Unknown,
    })
  })
})
