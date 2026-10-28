const mockFiles = new Map<string, number>()
const mockDirs = new Set<string>()
const mockMkdir = jest.fn(async (path: string) => {
  mockDirs.add(path)
})
const mockMoveFile = jest.fn(async (from: string, to: string) => {
  // iOS NSFileManager refuses an existing destination; Android would overwrite
  if (mockFiles.has(to)) throw new Error(`${to} already exists`)
  const size = mockFiles.get(from)
  if (size === undefined) throw new Error(`${from} does not exist`)
  mockFiles.delete(from)
  mockFiles.set(to, size)
})
const mockUnlink = jest.fn(async (path: string) => {
  if (mockDirs.delete(path)) {
    for (const file of [...mockFiles.keys()]) {
      if (file.startsWith(`${path}/`)) mockFiles.delete(file)
    }
    return
  }
  if (!mockFiles.delete(path)) throw new Error(`${path} does not exist`)
})

jest.mock("react-native-fs", () => ({
  CachesDirectoryPath: "/caches",
  DocumentDirectoryPath: "/documents",
  mkdir: (path: string) => mockMkdir(path),
  exists: async (path: string) => mockFiles.has(path) || mockDirs.has(path),
  stat: async (path: string) => {
    const size = mockFiles.get(path)
    if (size === undefined) throw new Error(`${path} does not exist`)
    return { size }
  },
  moveFile: (from: string, to: string) => mockMoveFile(from, to),
  unlink: (path: string) => mockUnlink(path),
}))

const mockRecordErrorOnce = jest.fn()
jest.mock("@app/self-custodial/logging", () => ({
  recordErrorOnce: (...args: unknown[]) => mockRecordErrorOnce(...args),
}))

import { SDK_LOG_ROTATE_BYTES } from "@app/self-custodial/config"
import {
  deleteSdkLogs,
  prepareSdkLogDir,
} from "@app/self-custodial/diagnostics/sdk-log-files"

const DIR = "/caches/breez-sdk-logs"
const CURRENT = `${DIR}/sdk.log`
const PREVIOUS = `${DIR}/sdk.log.1`

describe("prepareSdkLogDir", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFiles.clear()
    mockDirs.clear()
  })

  it("creates the caches directory and returns it on a first launch", async () => {
    await expect(prepareSdkLogDir()).resolves.toBe(DIR)

    expect(mockMkdir).toHaveBeenCalledWith(DIR)
    expect(mockMoveFile).not.toHaveBeenCalled()
  })

  it("keeps appending to a log at the cap", async () => {
    mockFiles.set(CURRENT, SDK_LOG_ROTATE_BYTES)

    await expect(prepareSdkLogDir()).resolves.toBe(DIR)

    expect(mockFiles.get(CURRENT)).toBe(SDK_LOG_ROTATE_BYTES)
    expect(mockMoveFile).not.toHaveBeenCalled()
  })

  it("moves a log over the cap to the previous generation", async () => {
    mockFiles.set(CURRENT, SDK_LOG_ROTATE_BYTES + 1)

    await expect(prepareSdkLogDir()).resolves.toBe(DIR)

    expect(mockFiles.has(CURRENT)).toBe(false)
    expect(mockFiles.get(PREVIOUS)).toBe(SDK_LOG_ROTATE_BYTES + 1)
  })

  it("replaces an existing previous generation, which moveFile alone refuses on iOS", async () => {
    mockFiles.set(CURRENT, SDK_LOG_ROTATE_BYTES + 1)
    mockFiles.set(PREVIOUS, 123)

    await prepareSdkLogDir()

    expect(mockFiles.has(CURRENT)).toBe(false)
    expect(mockFiles.get(PREVIOUS)).toBe(SDK_LOG_ROTATE_BYTES + 1)
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })

  it("drops an oversized log it cannot move, so the file cannot grow without bound", async () => {
    mockFiles.set(CURRENT, SDK_LOG_ROTATE_BYTES + 1)
    mockMoveFile.mockRejectedValueOnce(new Error("move failed"))

    await expect(prepareSdkLogDir()).resolves.toBe(DIR)

    expect(mockFiles.has(CURRENT)).toBe(false)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-rotate",
      expect.objectContaining({ message: "move failed" }),
      { expected: true },
    )
  })

  it("still returns the directory when the rotation itself throws", async () => {
    mockFiles.set(CURRENT, SDK_LOG_ROTATE_BYTES + 1)
    mockMoveFile.mockRejectedValueOnce(new Error("move failed"))
    mockUnlink.mockRejectedValueOnce(new Error("unlink failed"))

    await expect(prepareSdkLogDir()).resolves.toBe(DIR)

    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-rotate",
      expect.objectContaining({ message: "unlink failed" }),
      { expected: true },
    )
  })

  it("resolves undefined when the directory cannot be created", async () => {
    mockMkdir.mockRejectedValueOnce(new Error("read-only"))

    await expect(prepareSdkLogDir()).resolves.toBeUndefined()

    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-mkdir",
      expect.objectContaining({ message: "read-only" }),
      { expected: true },
    )
  })
})

describe("deleteSdkLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFiles.clear()
    mockDirs.clear()
  })

  it("removes the directory with both generations", async () => {
    mockDirs.add(DIR)
    mockFiles.set(CURRENT, 10)
    mockFiles.set(PREVIOUS, 20)

    await deleteSdkLogs()

    expect(mockUnlink).toHaveBeenCalledWith(DIR)
    expect(mockDirs.has(DIR)).toBe(false)
    expect(mockFiles.size).toBe(0)
  })

  it("removes a built export with the logs", async () => {
    mockDirs.add("/caches/breez-sdk-log-exports")
    mockFiles.set("/caches/breez-sdk-log-exports/blink-wallet-logs-x.txt", 30)

    await deleteSdkLogs()

    expect(mockUnlink).toHaveBeenCalledWith("/caches/breez-sdk-log-exports")
    expect(mockFiles.size).toBe(0)
  })

  it("does nothing when there are no logs", async () => {
    await deleteSdkLogs()

    expect(mockUnlink).not.toHaveBeenCalled()
  })

  it("swallows an unlink failure so deleting a wallet never fails on it", async () => {
    mockDirs.add(DIR)
    mockUnlink.mockRejectedValueOnce(new Error("busy"))

    await expect(deleteSdkLogs()).resolves.toBeUndefined()

    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-delete",
      expect.objectContaining({ message: "busy" }),
      { expected: true },
    )
  })
})
