jest.mock(
  "react-native-fs",
  () => jest.requireActual<typeof import("./inode-fs")>("./inode-fs").rnfs,
)

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  initLogging: (logDir: string | undefined) =>
    jest.requireActual<typeof import("./inode-fs")>("./inode-fs").initLogging(logDir),
}))

const mockRecordErrorOnce = jest.fn()
jest.mock("@app/self-custodial/logging", () => ({
  createSdkLogListener: () => ({ log: () => undefined }),
  recordErrorOnce: (...args: unknown[]) => mockRecordErrorOnce(...args),
}))

import { SDK_LOG_ROTATE_BYTES } from "@app/self-custodial/config"

import {
  endProcess,
  failNext,
  hasPath,
  loggerStarts,
  makeDir,
  readText,
  resetDisk,
  sdkWrites,
  writeText,
} from "./inode-fs"

const DIR = "/caches/breez-sdk-logs"
const CURRENT = `${DIR}/sdk.log`
const PREVIOUS = `${DIR}/sdk.log.1`
const MARKER = `${DIR}/sdk.log.purge`
const EXPORTS = "/caches/breez-sdk-log-exports"

/** The module's state is per process; each call is a fresh app launch on the same disk. */
const launch = () => {
  let mod: typeof import("@app/self-custodial/diagnostics/sdk-log-files") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/diagnostics/sdk-log-files")
  })
  return mod!
}

const oversized = (fill: string) => fill.repeat(SDK_LOG_ROTATE_BYTES + 1)

describe("startSdkLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDisk()
  })

  it("opens sdk.log in the caches directory on a first launch", async () => {
    await launch().startSdkLogger()
    sdkWrites("first line")

    expect(readText(CURRENT)).toBe("first line\n")
    expect(loggerStarts()).toBe(1)
  })

  it("starts once for connects that race, and once per process after", async () => {
    const logs = launch()

    await Promise.all([logs.startSdkLogger(), logs.startSdkLogger()])
    await logs.startSdkLogger()

    expect(loggerStarts()).toBe(1)
  })

  it("keeps appending to a log at the cap", async () => {
    writeText(CURRENT, "x".repeat(SDK_LOG_ROTATE_BYTES))

    await launch().startSdkLogger()

    expect(hasPath(PREVIOUS)).toBe(false)
    expect(readText(CURRENT)).toHaveLength(SDK_LOG_ROTATE_BYTES)
  })

  it("moves a log over the cap aside, replacing the previous generation", async () => {
    writeText(PREVIOUS, "oldest")
    writeText(CURRENT, oversized("a"))

    await launch().startSdkLogger()
    sdkWrites("fresh")

    expect(readText(PREVIOUS)).toBe(oversized("a"))
    expect(readText(CURRENT)).toBe("fresh\n")
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })

  it("drops an oversized log it cannot move, so the file cannot grow without bound", async () => {
    writeText(CURRENT, oversized("a"))
    failNext("moveFile", CURRENT, new Error("move failed"))

    await launch().startSdkLogger()
    sdkWrites("fresh")

    expect(readText(CURRENT)).toBe("fresh\n")
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-rotate",
      expect.objectContaining({ message: "move failed" }),
      { expected: true },
    )
  })

  it("still opens the file when the rotation fallback fails too", async () => {
    writeText(CURRENT, oversized("a"))
    failNext("moveFile", CURRENT)
    failNext("unlink", CURRENT, new Error("unlink failed"))

    await launch().startSdkLogger()
    sdkWrites("fresh")

    expect(readText(CURRENT)?.endsWith("fresh\n")).toBe(true)
    expect(mockRecordErrorOnce).toHaveBeenLastCalledWith(
      "sdk-log-rotate",
      expect.objectContaining({ message: "unlink failed" }),
      { expected: true },
    )
  })

  it("logs without a file when the directory cannot be created", async () => {
    failNext("mkdir", DIR, new Error("read-only"))

    await launch().startSdkLogger()
    sdkWrites("nowhere")

    expect(loggerStarts()).toBe(1)
    expect(hasPath(CURRENT)).toBe(false)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-mkdir",
      expect.objectContaining({ message: "read-only" }),
      { expected: true },
    )
  })

  it("does not retry when it already started without a file", async () => {
    failNext("mkdir", DIR)
    failNext("initLogging", "", new Error("already initialised"))

    await expect(launch().startSdkLogger()).resolves.toBeUndefined()

    expect(loggerStarts()).toBe(0)
    expect(mockRecordErrorOnce).not.toHaveBeenCalledWith(
      "sdk-log-file-init",
      expect.anything(),
    )
  })

  it("retries without a file, and records it once, when the file cannot be opened", async () => {
    failNext("initLogging", DIR, new Error("Permission denied"))

    await launch().startSdkLogger()

    expect(loggerStarts()).toBe(1)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-file-init",
      expect.objectContaining({ message: "Permission denied" }),
    )
  })

  it("stays silent when the retry fails too, since the file was not the cause", async () => {
    failNext("initLogging", DIR)
    failNext("initLogging", "")

    await expect(launch().startSdkLogger()).resolves.toBeUndefined()

    expect(loggerStarts()).toBe(0)
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })
})

describe("deleteSdkLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDisk()
  })

  it("removes the logs and exports at once when no logger holds the file", async () => {
    writeText(CURRENT, "wallet A\n")
    writeText(PREVIOUS, "wallet A older\n")
    writeText(`${EXPORTS}/blink-wallet-logs-x.txt`, "wallet A export")
    makeDir(DIR)
    makeDir(EXPORTS)
    const logs = launch()

    await logs.deleteSdkLogs()

    expect([CURRENT, PREVIOUS, DIR, EXPORTS].some(hasPath)).toBe(false)
    await expect(logs.readSdkLogDeletedThroughByte()).resolves.toBeUndefined()
  })

  it("cuts off a file the running logger holds instead of orphaning it", async () => {
    writeText(PREVIOUS, "wallet A older\n")
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")

    await logs.deleteSdkLogs()
    sdkWrites("wallet B")

    expect(hasPath(PREVIOUS)).toBe(false)
    expect(readText(MARKER)).toBe(String("wallet A\n".length))
    expect(readText(CURRENT)).toBe("wallet A\nwallet B\n")
    await expect(logs.readSdkLogDeletedThroughByte()).resolves.toBe("wallet A\n".length)
  })

  it("removes everything now when the cut-off cannot be recorded", async () => {
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")
    failNext("writeFile", MARKER, new Error("disk full"))

    await logs.deleteSdkLogs()

    expect(hasPath(DIR)).toBe(false)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-delete",
      expect.objectContaining({ message: "disk full" }),
      { expected: true },
    )
  })

  it("does nothing when there are no logs", async () => {
    await expect(launch().deleteSdkLogs()).resolves.toBeUndefined()

    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })
})

describe("the next launch after a deletion", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDisk()
  })

  const deleteWhileLogging = async (afterDeletion: string[] = []) => {
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A paid 1000 sats")
    await logs.deleteSdkLogs()
    afterDeletion.forEach(sdkWrites)
    endProcess()
  }

  it("removes the deleted lines before the logger opens the file again", async () => {
    await deleteWhileLogging()

    await launch().startSdkLogger()
    sdkWrites("fresh")

    expect(readText(CURRENT)).toBe("fresh\n")
    expect(hasPath(MARKER)).toBe(false)
  })

  it("keeps what a wallet restored after the deletion wrote", async () => {
    await deleteWhileLogging(["wallet B restored"])

    await launch().startSdkLogger()
    sdkWrites("next session")

    expect(readText(CURRENT)).toBe("wallet B restored\nnext session\n")
  })

  it("reads the cut-off from disk when exporting before the purge has run", async () => {
    await deleteWhileLogging(["wallet B restored"])

    await expect(launch().readSdkLogDeletedThroughByte()).resolves.toBe(
      "wallet A paid 1000 sats\n".length,
    )
  })

  it("drops the whole file when the marker is unreadable", async () => {
    await deleteWhileLogging(["wallet B restored"])
    writeText(MARKER, "not a number")

    const logs = launch()
    await expect(logs.readSdkLogDeletedThroughByte()).resolves.toBe(
      Number.POSITIVE_INFINITY,
    )
    await logs.startSdkLogger()

    expect(readText(CURRENT)).toBe("")
  })

  it("removes a previous generation that the deletion itself could not", async () => {
    writeText(PREVIOUS, "wallet A older\n")
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")
    failNext("unlink", PREVIOUS)
    failNext("unlink", DIR)
    await logs.deleteSdkLogs()
    endProcess()
    expect(readText(PREVIOUS)).toBe("wallet A older\n")

    await launch().startSdkLogger()

    expect(hasPath(PREVIOUS)).toBe(false)
  })

  it("logs without a file, keeping the marker, when the purge fails", async () => {
    await deleteWhileLogging()
    failNext("unlink", CURRENT, new Error("busy"))

    await launch().startSdkLogger()
    sdkWrites("nowhere")

    expect(readText(CURRENT)).toBe("wallet A paid 1000 sats\n")
    expect(hasPath(MARKER)).toBe(true)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-purge",
      expect.objectContaining({ message: "busy" }),
      { expected: true },
    )
  })
})
