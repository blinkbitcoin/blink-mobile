const mockFiles = new Map<string, Buffer>()
const mockDirs = new Set<string>()
type ReadArgs = [path: string, length: number, position: number, encoding: string]
const mockRead = jest.fn(async (...[path, length, position, encoding]: ReadArgs) => {
  if (encoding !== "base64") throw new Error("utf8 reads throw on a split character")
  const file = mockFiles.get(path)
  if (!file) throw new Error(`${path} does not exist`)
  return file.subarray(position, position + length).toString("base64")
})
const mockReadFile = jest.fn()
const mockUnlink = jest.fn(async (path: string) => {
  mockDirs.delete(path)
  for (const file of [...mockFiles.keys()]) {
    if (file.startsWith(`${path}/`)) mockFiles.delete(file)
  }
})

jest.mock("react-native-fs", () => ({
  CachesDirectoryPath: "/caches",
  DocumentDirectoryPath: "/documents",
  exists: async (path: string) => mockFiles.has(path) || mockDirs.has(path),
  stat: async (path: string) => ({ size: mockFiles.get(path)?.length ?? 0 }),
  read: (...args: ReadArgs) => mockRead(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  mkdir: async (path: string) => {
    mockDirs.add(path)
  },
  unlink: (path: string) => mockUnlink(path),
  writeFile: async (path: string, contents: string) => {
    mockFiles.set(path, Buffer.from(contents, "utf8"))
  },
}))

/** A small cap so the budget logic is visible without megabytes of fixture. */
const CAP = 120
jest.mock("@app/self-custodial/config", () => ({
  ...jest.requireActual("@app/self-custodial/config"),
  SDK_LOG_EXPORT_BYTES: 120,
}))

jest.mock("@app/self-custodial/logging", () => ({ recordErrorOnce: jest.fn() }))

import { exportSdkLogs } from "@app/self-custodial/diagnostics/export-sdk-logs"

const LOG_DIR = "/caches/breez-sdk-logs"
const CURRENT = `${LOG_DIR}/sdk.log`
const PREVIOUS = `${LOG_DIR}/sdk.log.1`
const EXPORT_DIR = "/caches/breez-sdk-log-exports"
const NOW = new Date("2026-10-28T09:05:00Z")

const writeLog = (path: string, text: string) => mockFiles.set(path, Buffer.from(text))
const exportedText = (path: string | null) => mockFiles.get(path!)!.toString("utf8")

describe("exportSdkLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFiles.clear()
    mockDirs.clear()
  })

  it("returns null and writes nothing when the SDK has not logged yet", async () => {
    await expect(exportSdkLogs("header\n", NOW)).resolves.toBeNull()

    expect(mockDirs.has(EXPORT_DIR)).toBe(false)
  })

  it("returns null for an empty log", async () => {
    writeLog(CURRENT, "")

    await expect(exportSdkLogs("header\n", NOW)).resolves.toBeNull()
  })

  it("writes the header and the whole log to a UTC-stamped file", async () => {
    writeLog(CURRENT, "line one\nline two\n")

    const path = await exportSdkLogs("header\n", NOW)

    expect(path).toBe(`${EXPORT_DIR}/blink-wallet-logs-20261028-0905.txt`)
    expect(exportedText(path)).toBe("header\n\n--- sdk.log ---\nline one\nline two\n")
  })

  it("puts the previous generation before the current one", async () => {
    writeLog(PREVIOUS, "old\n")
    writeLog(CURRENT, "new\n")

    const path = await exportSdkLogs("h\n", NOW)

    expect(exportedText(path)).toBe(
      "h\n\n--- sdk.log.1 ---\nold\n\n--- sdk.log ---\nnew\n",
    )
  })

  it("keeps the newest bytes of an oversized log, from a whole line on", async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i}\n`).join("")
    writeLog(CURRENT, lines)

    const path = await exportSdkLogs("h\n", NOW)
    const body = exportedText(path).split("--- sdk.log ---\n")[1]

    expect(body.startsWith("line ")).toBe(true)
    expect(body.endsWith("line 29\n")).toBe(true)
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(CAP)
    expect(mockReadFile).not.toHaveBeenCalled()
  })

  it("gives the previous generation only what the current one left of the cap", async () => {
    // 12 lines of 9 bytes; the current log's 29 bytes leave 91, which start on line b's newline
    writeLog(PREVIOUS, [..."abcdefghijkl"].map((c) => `${c.repeat(8)}\n`).join(""))
    writeLog(CURRENT, "0123456789012345678901234567\n")

    const path = await exportSdkLogs("h\n", NOW)

    expect(mockRead).toHaveBeenCalledWith(PREVIOUS, CAP - 29, 108 - (CAP - 29), "base64")
    expect(exportedText(path)).toContain("--- sdk.log.1 ---\ncccccccc\n")
    expect(exportedText(path)).not.toContain("bbbbbbbb")
  })

  it("skips the previous generation when the current log fills the cap", async () => {
    writeLog(PREVIOUS, "old\n")
    writeLog(CURRENT, "x".repeat(CAP) + "\nlast\n")

    const path = await exportSdkLogs("h\n", NOW)

    expect(mockRead).not.toHaveBeenCalledWith(
      PREVIOUS,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
    expect(exportedText(path)).toBe("h\n\n--- sdk.log ---\nlast\n")
  })

  it("starts cleanly when the cut lands inside a multi-byte character", async () => {
    // "€" is 3 bytes; "\nafter €\n" is 10, so the last CAP bytes begin one byte into it
    writeLog(CURRENT, `${"x".repeat(10)}€${"y".repeat(CAP - 12)}\nafter €\n`)

    const path = await exportSdkLogs("h\n", NOW)

    expect(exportedText(path)).toBe("h\n\n--- sdk.log ---\nafter €\n")
  })

  it("drops a tail holding only part of one line", async () => {
    // one unterminated line longer than the cap: the tail has no newline to start after
    writeLog(CURRENT, "x".repeat(CAP * 2))

    await expect(exportSdkLogs("h\n", NOW)).resolves.toBeNull()
  })

  it("removes the previous export before writing a new one", async () => {
    mockDirs.add(EXPORT_DIR)
    mockFiles.set(`${EXPORT_DIR}/blink-wallet-logs-old.txt`, Buffer.from("old"))
    writeLog(CURRENT, "new\n")

    const path = await exportSdkLogs("h\n", NOW)

    expect(mockFiles.has(`${EXPORT_DIR}/blink-wallet-logs-old.txt`)).toBe(false)
    expect(mockFiles.has(path!)).toBe(true)
  })

  it("redacts preimages in the written file", async () => {
    writeLog(CURRENT, `preimage: Some("${"ab".repeat(32)}")\n`)

    const path = await exportSdkLogs("h\n", NOW)

    expect(exportedText(path)).toContain(`preimage: Some("<redacted>")`)
  })
})
